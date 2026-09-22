#include "pch.h"
#include "SynthModule.h"

#include <mmdeviceapi.h>
#include <audioclient.h>
#include <ksmedia.h>
#include <winrt/Windows.ApplicationModel.h>
#include <wrl/client.h>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <mutex>
#include <thread>
#include <vector>

#include "third_party/stb_vorbis.c"
#define TSF_IMPLEMENTATION
#include "third_party/tsf.h"

#pragma comment(lib, "avrt.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "mmdevapi.lib")

using Microsoft::WRL::ComPtr;

namespace winrt::MoosiacRN::implementation {

namespace {

constexpr int kDrumBank = 128;
constexpr int kStandardKit = 0;
constexpr int kPercussionChannel = 9;
constexpr int kDefaultSampleRate = 48000;
constexpr float kInitialGain = 0.35f;

struct ScheduledEvent {
  uint64_t sample;
  bool on;
  int channel;
  int midi;
  float velocity;
};

struct Instance {
  tsf *synth = nullptr;
  IMMDevice *device = nullptr;
  IAudioClient *audioClient = nullptr;
  IAudioRenderClient *renderClient = nullptr;
  HANDLE event = nullptr;
  HANDLE stopEvent = nullptr;
  std::thread thread;
  std::vector<ScheduledEvent> events;
  std::vector<float> chorusDelayLeft;
  std::vector<float> chorusDelayRight;
  std::vector<float> reverbDelayLeft;
  std::vector<float> reverbDelayRight;
  size_t effectCursor = 0;
  double chorusPhase = 0;
  bool chorusActive = true;
  bool reverbActive = true;
  uint64_t renderedSamples = 0;
  UINT32 bufferFrames = 0;
  UINT32 channels = 2;
  double sampleRate = kDefaultSampleRate;
  std::atomic<bool> running{false};
  std::mutex *ownerMutex = nullptr;
};

void closeInstance(Instance &instance) {
  instance.running.store(false);
  if (instance.stopEvent) SetEvent(instance.stopEvent);
  if (instance.thread.joinable()) instance.thread.join();
  if (instance.audioClient) instance.audioClient->Stop();
  if (instance.synth) tsf_close(instance.synth);
  if (instance.event) CloseHandle(instance.event);
  if (instance.stopEvent) CloseHandle(instance.stopEvent);
  if (instance.renderClient) instance.renderClient->Release();
  if (instance.audioClient) instance.audioClient->Release();
  if (instance.device) instance.device->Release();
  instance.synth = nullptr;
  instance.device = nullptr;
  instance.audioClient = nullptr;
  instance.renderClient = nullptr;
  instance.event = nullptr;
  instance.stopEvent = nullptr;
  instance.events.clear();
  instance.renderedSamples = 0;
  instance.ownerMutex = nullptr;
}

void applyEvents(Instance &instance, uint64_t endSample) {
  while (!instance.events.empty() && instance.events.front().sample <= endSample) {
    const auto event = instance.events.front();
    instance.events.erase(instance.events.begin());
    if (event.on) {
      tsf_channel_note_on(instance.synth, event.channel, event.midi, event.velocity);
    } else {
      tsf_channel_note_off(instance.synth, event.channel, event.midi);
    }
  }
}

void applyEffects(Instance &instance, std::vector<float> &stereo,
                  UINT32 frames) {
  if ((!instance.chorusActive && !instance.reverbActive) ||
      instance.chorusDelayLeft.empty()) return;

  constexpr float kTwoPi = 6.2831853071795864769f;
  constexpr float kChorusWet = 0.16f;
  constexpr float kReverbWet = 0.14f;
  constexpr float kReverbFeedback = 0.36f;
  const auto delaySize = instance.chorusDelayLeft.size();
  for (UINT32 frame = 0; frame < frames; frame++) {
    const size_t cursor = instance.effectCursor;
    const float left = stereo[frame * 2];
    const float right = stereo[frame * 2 + 1];

    float chorusLeft = 0;
    float chorusRight = 0;
    if (instance.chorusActive) {
      // A small modulated delay gives the same spatial thickening users expect
      // from the web/Mac chorus without allocating an audio effect library.
      const double modulation = (std::sin(instance.chorusPhase) + 1.0) * 0.5;
      const size_t delay = static_cast<size_t>(0.014 * instance.sampleRate +
                                               modulation * 0.008 * instance.sampleRate);
      const size_t read = (cursor + delaySize - std::min(delay, delaySize - 1)) % delaySize;
      chorusLeft = instance.chorusDelayLeft[read];
      chorusRight = instance.chorusDelayRight[read];
      instance.chorusPhase += kTwoPi * 0.22 / instance.sampleRate;
      if (instance.chorusPhase >= kTwoPi) instance.chorusPhase -= kTwoPi;
    }

    float reverbLeft = 0;
    float reverbRight = 0;
    if (instance.reverbActive) {
      const size_t readA = (cursor + delaySize -
                            static_cast<size_t>(0.113 * instance.sampleRate)) % delaySize;
      const size_t readB = (cursor + delaySize -
                            static_cast<size_t>(0.173 * instance.sampleRate)) % delaySize;
      reverbLeft = instance.reverbDelayLeft[readA] * 0.62f +
                   instance.reverbDelayLeft[readB] * 0.38f;
      reverbRight = instance.reverbDelayRight[readA] * 0.62f +
                    instance.reverbDelayRight[readB] * 0.38f;
    }

    instance.chorusDelayLeft[cursor] = left;
    instance.chorusDelayRight[cursor] = right;
    instance.reverbDelayLeft[cursor] = left + reverbLeft * kReverbFeedback;
    instance.reverbDelayRight[cursor] = right + reverbRight * kReverbFeedback;
    stereo[frame * 2] = left + (instance.chorusActive ? chorusLeft * kChorusWet : 0) +
                        (instance.reverbActive ? reverbLeft * kReverbWet : 0);
    stereo[frame * 2 + 1] = right + (instance.chorusActive ? chorusRight * kChorusWet : 0) +
                            (instance.reverbActive ? reverbRight * kReverbWet : 0);
    instance.effectCursor = (cursor + 1) % delaySize;
  }
}

void audioLoop(Instance *instance) {
  CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  HANDLE waits[] = {instance->event, instance->stopEvent};
  std::vector<float> stereo;
  instance->running.store(true);

  while (instance->running.load()) {
    const DWORD wait = WaitForMultipleObjects(2, waits, FALSE, 1000);
    if (wait == WAIT_OBJECT_0 + 1 || wait == WAIT_FAILED) break;

    UINT32 padding = 0;
    if (FAILED(instance->audioClient->GetCurrentPadding(&padding))) break;
    const UINT32 frames = instance->bufferFrames > padding ? instance->bufferFrames - padding : 0;
    if (frames == 0) continue;

    BYTE *raw = nullptr;
    if (FAILED(instance->renderClient->GetBuffer(frames, &raw))) break;
    auto *output = reinterpret_cast<float *>(raw);
    stereo.assign(static_cast<size_t>(frames) * 2, 0.0f);
    {
      // TSF is not re-entrant. The same lock gives noteAt a sample-clock
      // boundary, so scheduled events cannot race the audio callback.
      std::lock_guard lock(*instance->ownerMutex);
      applyEvents(*instance, instance->renderedSamples + frames);
      tsf_render_float(instance->synth, stereo.data(), static_cast<int>(frames), TSF_FALSE);
      applyEffects(*instance, stereo, frames);
      instance->renderedSamples += frames;
    }
    for (UINT32 frame = 0; frame < frames; frame++) {
      for (UINT32 channel = 0; channel < instance->channels; channel++) {
        output[frame * instance->channels + channel] =
            channel == 0 ? stereo[frame * 2] :
            channel == 1 ? stereo[frame * 2 + 1] : 0.0f;
      }
    }
    instance->renderClient->ReleaseBuffer(frames, 0);
  }

  if (instance->audioClient) instance->audioClient->Stop();
  CoUninitialize();
}

} // namespace

struct WindowsSynthState {
  std::mutex mutex;
  std::vector<std::unique_ptr<Instance>> instances;
  std::string soundfontPath;
  int interpolation = 1;
  double masterVolume = 1.0;
  float initialGain = kInitialGain;
  bool chorusActive = true;
  bool reverbActive = true;

  ~WindowsSynthState() {
    for (auto &instance : instances) closeInstance(*instance);
  }

  bool addInstance(std::string &error) {
    auto instance = std::make_unique<Instance>();
    instance->synth = tsf_load_filename(soundfontPath.c_str());
    if (!instance->synth) {
      error = "Could not load the bundled SoundFont.";
      return false;
    }
    tsf_set_max_voices(instance->synth, 2048);
    tsf_set_interpolation(instance->synth, interpolation);
    tsf_set_volume(instance->synth, initialGain * static_cast<float>(masterVolume));

    ComPtr<IMMDeviceEnumerator> enumerator;
    HRESULT hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                          IID_PPV_ARGS(&enumerator));
    if (FAILED(hr) || FAILED(enumerator->GetDefaultAudioEndpoint(eRender, eConsole, &instance->device))) {
      error = "Could not find the Windows audio device."; closeInstance(*instance); return false;
    }
    WAVEFORMATEX *format = nullptr;
    hr = instance->device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                                   reinterpret_cast<void **>(&instance->audioClient));
    if (FAILED(hr) || FAILED(instance->audioClient->GetMixFormat(&format))) {
      error = "Could not open the Windows audio client."; closeInstance(*instance); return false;
    }
    instance->sampleRate = format->nSamplesPerSec;
    instance->channels = format->nChannels;
    instance->chorusActive = chorusActive;
    instance->reverbActive = reverbActive;
    const auto effectSamples = static_cast<size_t>(instance->sampleRate);
    instance->chorusDelayLeft.assign(effectSamples, 0.0f);
    instance->chorusDelayRight.assign(effectSamples, 0.0f);
    instance->reverbDelayLeft.assign(effectSamples, 0.0f);
    instance->reverbDelayRight.assign(effectSamples, 0.0f);
    tsf_set_output(instance->synth, TSF_STEREO_INTERLEAVED,
                   static_cast<int>(instance->sampleRate), 0.0f);
    instance->event = CreateEvent(nullptr, FALSE, FALSE, nullptr);
    instance->stopEvent = CreateEvent(nullptr, TRUE, FALSE, nullptr);
    if (!instance->event || !instance->stopEvent) {
      CoTaskMemFree(format); error = "Could not create the audio events."; closeInstance(*instance); return false;
    }
    hr = instance->audioClient->Initialize(AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_EVENTCALLBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM,
        0, 0, format, nullptr);
    CoTaskMemFree(format);
    if (FAILED(hr) || FAILED(instance->audioClient->SetEventHandle(instance->event)) ||
        FAILED(instance->audioClient->GetBufferSize(&instance->bufferFrames)) ||
        FAILED(instance->audioClient->GetService(IID_PPV_ARGS(&instance->renderClient)))) {
      error = "Could not initialize shared-mode audio."; closeInstance(*instance); return false;
    }
    if (FAILED(instance->audioClient->Start())) {
      error = "Could not start shared-mode audio."; closeInstance(*instance); return false;
    }
    instance->ownerMutex = &mutex;
    instances.push_back(std::move(instance));
    auto &stored = *instances.back();
    stored.thread = std::thread(audioLoop, &stored);
    return true;
  }
};

bool SynthModule::isSupported() noexcept { return true; }

std::string SynthModule::bundledSoundfontPath() noexcept {
  return winrt::to_string(
      winrt::Windows::ApplicationModel::Package::Current().InstalledLocation().Path()) +
      "\\soundfont\\FluidR3Mono_GM.sf3";
}

void SynthModule::initialize(std::string soundfontUri, double instanceCount,
                             React::JSValueObject settings,
                             React::ReactPromise<React::JSValue> result) noexcept {
  if (!m_state) m_state = std::make_shared<WindowsSynthState>();
  auto state = m_state;
  std::thread([state, soundfontUri = std::move(soundfontUri), instanceCount,
               settings = std::move(settings), result = std::move(result)]() mutable {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    std::lock_guard lock(state->mutex);
    state->soundfontPath = soundfontUri.rfind("file://", 0) == 0 ? soundfontUri.substr(7) : soundfontUri;
    if (auto it = settings.find("initialGain"); it != settings.end() &&
        (it->second.TryGetDouble() || it->second.TryGetInt64())) {
      state->initialGain = static_cast<float>(it->second.AsDouble());
    }
    if (auto it = settings.find("chorusActive"); it != settings.end() && it->second.TryGetBoolean()) {
      state->chorusActive = *it->second.TryGetBoolean();
    }
    if (auto it = settings.find("reverbActive"); it != settings.end() && it->second.TryGetBoolean()) {
      state->reverbActive = *it->second.TryGetBoolean();
    }
    for (auto &instance : state->instances) closeInstance(*instance);
    state->instances.clear();
    std::string error;
    while (state->instances.size() < static_cast<size_t>(std::max(0.0, instanceCount))) {
      if (!state->addInstance(error)) {
        result.Reject(React::ReactError{"SYNTH_INIT", error});
        CoUninitialize();
        return;
      }
    }
    result.Resolve(React::JSValue{nullptr});
    CoUninitialize();
  }).detach();
}

void SynthModule::ensureInstances(double count, React::ReactPromise<React::JSValue> result) noexcept {
  if (!m_state) { result.Reject(React::ReactError{"SYNTH_INIT", "Synthesizer is not initialized."}); return; }
  auto state = m_state;
  std::thread([state, count, result = std::move(result)]() mutable {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    std::lock_guard lock(state->mutex); std::string error;
    while (state->instances.size() < static_cast<size_t>(std::max(0.0, count))) {
      if (!state->addInstance(error)) {
        result.Reject(React::ReactError{"SYNTH_INSTANCES", error});
        CoUninitialize();
        return;
      }
    }
    result.Resolve(React::JSValue{nullptr});
    CoUninitialize();
  }).detach();
}

double SynthModule::currentTime() noexcept {
  if (!m_state) return 0;
  std::lock_guard lock(m_state->mutex);
  return m_state->instances.empty() ? 0 : m_state->instances.front()->renderedSamples / m_state->instances.front()->sampleRate;
}

double SynthModule::outputLatency() noexcept {
  if (!m_state) return 0;
  std::lock_guard lock(m_state->mutex);
  return m_state->instances.empty() ? 0 : static_cast<double>(m_state->instances.front()->bufferFrames) / m_state->instances.front()->sampleRate;
}

void SynthModule::noteAt(double index, double channel, double midi, double velocity,
                         double delaySeconds, double durationSeconds) noexcept {
  if (!m_state) return; std::lock_guard lock(m_state->mutex);
  if (index < 0 || index >= static_cast<double>(m_state->instances.size())) return;
  auto &instance = *m_state->instances[static_cast<size_t>(index)];
  const auto start = instance.renderedSamples + static_cast<uint64_t>(std::max(0.0, delaySeconds) * instance.sampleRate);
  const auto duration = std::max<uint64_t>(1, static_cast<uint64_t>(std::max(0.0, durationSeconds) * instance.sampleRate));
  instance.events.push_back({start, true, static_cast<int>(channel), static_cast<int>(midi), static_cast<float>(velocity) / 127.0f});
  instance.events.push_back({start + duration, false, static_cast<int>(channel), static_cast<int>(midi), 0});
  std::sort(instance.events.begin(), instance.events.end(), [](const auto &a, const auto &b) { return a.sample < b.sample; });
}

void SynthModule::noteOn(double index, double channel, double midi, double velocity) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); if (index >= 0 && index < m_state->instances.size()) tsf_channel_note_on(m_state->instances[index]->synth, static_cast<int>(channel), static_cast<int>(midi), static_cast<float>(velocity) / 127.0f); }
void SynthModule::noteOff(double index, double channel, double midi) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); if (index >= 0 && index < m_state->instances.size()) tsf_channel_note_off(m_state->instances[index]->synth, static_cast<int>(channel), static_cast<int>(midi)); }
void SynthModule::programSelect(double index, double channel, double program) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); if (index >= 0 && index < m_state->instances.size() && static_cast<int>(channel) != kPercussionChannel) tsf_channel_set_presetnumber(m_state->instances[index]->synth, static_cast<int>(channel), static_cast<int>(program), 0); }
void SynthModule::setChannelPercussion(double index, double channel, double kit) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); if (index >= 0 && index < m_state->instances.size()) { auto *s = m_state->instances[index]->synth; tsf_channel_set_bank(s, static_cast<int>(channel), kDrumBank); tsf_channel_set_presetnumber(s, static_cast<int>(channel), static_cast<int>(kit < 0 ? kStandardKit : kit), 1); } }
void SynthModule::controlChange(double index, double channel, double control, double value) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); if (index >= 0 && index < m_state->instances.size()) tsf_channel_midi_control(m_state->instances[index]->synth, static_cast<int>(channel), static_cast<int>(control), static_cast<int>(value)); }
void SynthModule::cancelScheduledOn(double index) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); if (index >= 0 && index < m_state->instances.size()) m_state->instances[index]->events.clear(); }
void SynthModule::allSoundOff() noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); for (auto &i : m_state->instances) { i->events.clear(); tsf_note_off_all(i->synth); } }
void SynthModule::setInterpolation(double order) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); m_state->interpolation = static_cast<int>(order); for (auto &i : m_state->instances) tsf_set_interpolation(i->synth, static_cast<int>(order)); }
void SynthModule::setMasterVolume(double volume) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); m_state->masterVolume = volume; for (auto &i : m_state->instances) tsf_set_volume(i->synth, m_state->initialGain * static_cast<float>(volume)); }
void SynthModule::dispose() noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); for (auto &i : m_state->instances) closeInstance(*i); m_state->instances.clear(); }

} // namespace winrt::MoosiacRN::implementation

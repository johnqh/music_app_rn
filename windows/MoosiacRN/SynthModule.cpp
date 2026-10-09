#include "pch.h"
#include "SynthModule.h"
#include "MoosiacRN.h"

#include <mmdeviceapi.h>
#include <audioclient.h>
#include <functiondiscoverykeys_devpkey.h>
#include <propsys.h>
#include <ksmedia.h>
#include <wrl/client.h>
#include <winrt/Windows.Media.Capture.h>
#include <winrt/Windows.Media.MediaProperties.h>
#include <winrt/Windows.Storage.h>

#include <algorithm>
#include <array>
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
  std::atomic<uint64_t> renderedSamples{0};
  UINT32 bufferFrames = 0;
  UINT32 channels = 2;
  double sampleRate = kDefaultSampleRate;
  std::atomic<bool> running{false};
  std::mutex synthMutex;
};

void closeOutput(Instance &instance) {
  instance.running.store(false);
  if (instance.stopEvent) SetEvent(instance.stopEvent);
  if (instance.thread.joinable()) instance.thread.join();
  if (instance.audioClient) instance.audioClient->Stop();
  if (instance.event) CloseHandle(instance.event);
  if (instance.stopEvent) CloseHandle(instance.stopEvent);
  if (instance.renderClient) instance.renderClient->Release();
  if (instance.audioClient) instance.audioClient->Release();
  if (instance.device) instance.device->Release();
  instance.device = nullptr;
  instance.audioClient = nullptr;
  instance.renderClient = nullptr;
  instance.event = nullptr;
  instance.stopEvent = nullptr;
}

void closeInstance(Instance &instance) {
  closeOutput(instance);
  if (instance.synth) tsf_close(instance.synth);
  instance.synth = nullptr;
  instance.events.clear();
  instance.renderedSamples = 0;
}

/**
 * Inserts in time order, a note-off before a note-on at the same sample and
 * otherwise in the order scheduled. A repeated pitch's off and the next on
 * share a sample; `std::sort` (not stable) could put the on first, and the
 * off then silenced the note that had just started. Inserting also avoids
 * re-sorting the whole queue for every note under the instance lock.
 */
void insertEvent(std::vector<ScheduledEvent> &events, const ScheduledEvent &event) {
  const auto at = std::upper_bound(events.begin(), events.end(), event,
      [](const ScheduledEvent &a, const ScheduledEvent &b) {
        return a.sample != b.sample ? a.sample < b.sample : (!a.on && b.on);
      });
  events.insert(at, event);
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
      // Each instance renders on its own audio thread. Sharing the collection
      // lock with the metronome dropped music buffers whenever the other
      // instance rendered, also losing elapsed time from the playback clock.
      // Control calls take this instance lock; teardown joins without it.
      std::lock_guard lock(instance->synthMutex);
      applyEvents(*instance, instance->renderedSamples.load() + frames);
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

  instance->running.store(false);
  if (instance->audioClient) instance->audioClient->Stop();
  CoUninitialize();
}

bool openOutput(Instance &instance, const std::string &deviceId, std::string &error) {
  ComPtr<IMMDeviceEnumerator> enumerator;
  HRESULT hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                                IID_PPV_ARGS(&enumerator));
  if (FAILED(hr) || FAILED(deviceId.empty()
        ? enumerator->GetDefaultAudioEndpoint(eRender, eConsole, &instance.device)
        : enumerator->GetDevice(winrt::to_hstring(deviceId).c_str(), &instance.device))) {
    error = "Could not find the selected Windows audio output.";
    closeOutput(instance);
    return false;
  }

  WAVEFORMATEX *format = nullptr;
  hr = instance.device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                                 reinterpret_cast<void **>(&instance.audioClient));
  if (FAILED(hr) || FAILED(instance.audioClient->GetMixFormat(&format))) {
    error = "Could not open the Windows audio output.";
    closeOutput(instance);
    return false;
  }
  const double previousRate = instance.sampleRate;
  instance.sampleRate = format->nSamplesPerSec;
  // The render loop writes float stereo. An endpoint (including Remote
  // Audio) may expose integer PCM: do not write floats into that buffer.
  WAVEFORMATEX renderFormat{};
  renderFormat.wFormatTag = WAVE_FORMAT_IEEE_FLOAT;
  renderFormat.nChannels = 2;
  renderFormat.nSamplesPerSec = format->nSamplesPerSec;
  renderFormat.wBitsPerSample = 32;
  renderFormat.nBlockAlign = 2 * sizeof(float);
  renderFormat.nAvgBytesPerSec = renderFormat.nSamplesPerSec * renderFormat.nBlockAlign;
  instance.channels = renderFormat.nChannels;
  const auto effectSamples = static_cast<size_t>(instance.sampleRate);
  instance.chorusDelayLeft.assign(effectSamples, 0.0f);
  instance.chorusDelayRight.assign(effectSamples, 0.0f);
  instance.reverbDelayLeft.assign(effectSamples, 0.0f);
  instance.reverbDelayRight.assign(effectSamples, 0.0f);
  instance.effectCursor = 0;
  tsf_set_output(instance.synth, TSF_STEREO_INTERLEAVED,
                 static_cast<int>(instance.sampleRate), 0.0f);
  instance.event = CreateEvent(nullptr, FALSE, FALSE, nullptr);
  instance.stopEvent = CreateEvent(nullptr, TRUE, FALSE, nullptr);
  if (!instance.event || !instance.stopEvent) {
    CoTaskMemFree(format);
    error = "Could not create the audio events.";
    closeOutput(instance);
    return false;
  }
  hr = instance.audioClient->Initialize(AUDCLNT_SHAREMODE_SHARED,
      AUDCLNT_STREAMFLAGS_EVENTCALLBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM |
          AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY,
      0, 0, &renderFormat, nullptr);
  CoTaskMemFree(format);
  if (FAILED(hr) || FAILED(instance.audioClient->SetEventHandle(instance.event)) ||
      FAILED(instance.audioClient->GetBufferSize(&instance.bufferFrames)) ||
      FAILED(instance.audioClient->GetService(IID_PPV_ARGS(&instance.renderClient))) ||
      FAILED(instance.audioClient->Start())) {
    error = "Could not initialize the selected audio output.";
    closeOutput(instance);
    return false;
  }
  if (previousRate > 0 && previousRate != instance.sampleRate) {
    const double ratio = instance.sampleRate / previousRate;
    instance.renderedSamples = static_cast<uint64_t>(instance.renderedSamples.load() * ratio);
    for (auto &event : instance.events)
      event.sample = static_cast<uint64_t>(event.sample * ratio);
  }
  instance.running.store(true);
  instance.thread = std::thread(audioLoop, &instance);
  return true;
}

} // namespace

struct WindowsSynthState {
  std::mutex mutex;
  std::vector<std::unique_ptr<Instance>> instances;
  std::string soundfontPath;
  /**
   * The soundfont, decoded once. Every instance is a `tsf_copy` of it, which
   * shares the samples: the SF3 is Ogg-compressed, and decoding it per
   * instance cost a full decode and a full copy of the samples (hundreds of
   * MB) for each — the music and the metronome click at the least.
   */
  tsf *font = nullptr;
  std::string fontPath;
  int interpolation = 1;
  double masterVolume = 1.0;
  float initialGain = kInitialGain;
  bool chorusActive = true;
  bool reverbActive = true;
  std::string outputDeviceId;
  std::array<unsigned char, 256> programs{};
  double clockOffset = 0;
  size_t targetInstanceCount = 0;

  ~WindowsSynthState() {
    for (auto &instance : instances) closeInstance(*instance);
    if (font) tsf_close(font);
  }

  /** Adopts a decoded font, closing the one it replaces. Under the lock. */
  void adoptFont(tsf *loaded, const std::string &path,
                 const std::array<unsigned char, 256> &loadedPrograms) {
    if (font) tsf_close(font);
    font = loaded;
    fontPath = path;
    programs = loadedPrograms;
  }

  bool addInstance(std::string &error) {
    auto instance = std::make_unique<Instance>();
    instance->synth = tsf_copy(font);
    if (!instance->synth) {
      error = "Could not load the bundled SoundFont.";
      return false;
    }
    tsf_set_max_voices(instance->synth, 2048);
    tsf_set_interpolation(instance->synth, interpolation);
    tsf_set_volume(instance->synth, initialGain * static_cast<float>(masterVolume));
    instance->chorusActive = chorusActive;
    instance->reverbActive = reverbActive;
    if (!openOutput(*instance, outputDeviceId, error)) {
      closeInstance(*instance);
      return false;
    }
    instances.push_back(std::move(instance));
    return true;
  }
};

std::array<unsigned char, 256> programMaskFromSettings(
    const React::JSValueObject &settings) {
  std::array<unsigned char, 256> mask{};
  auto add = [&settings, &mask](const char *key, size_t offset) {
    auto it = settings.find(key);
    if (it == settings.end()) return;
    const auto *values = it->second.TryGetArray();
    if (!values) return;
    for (const auto &value : *values) {
      const int program = value.AsInt32();
      if (program >= 0 && program < 128) mask[offset + program] = 1;
    }
  };
  add("melodicPrograms", 0);
  add("percussionPrograms", 128);
  // Keep a usable default when called by an older JS bundle.
  if (std::none_of(mask.begin(), mask.end(), [](unsigned char used) { return used != 0; })) {
    mask[0] = 1;
    mask[128] = 1;
  }
  return mask;
}

struct WindowsVoiceState {
  std::mutex mutex;
  winrt::Windows::Media::Capture::MediaCapture capture{nullptr};
  winrt::Windows::Storage::StorageFile file{nullptr};
  bool recording = false;
};

bool SynthModule::isSupported() noexcept { return true; }

void SynthModule::startVoiceRecording(
    React::ReactPromise<React::JSValue> result) noexcept {
  if (!m_voice) m_voice = std::make_shared<WindowsVoiceState>();
  auto state = m_voice;
  std::thread([state, result = std::move(result)]() mutable {
    winrt::init_apartment(winrt::apartment_type::multi_threaded);
    std::lock_guard lock(state->mutex);
    if (state->recording) {
      result.Reject(React::ReactError{"MIC_BUSY", "A recording is already active."});
      return;
    }
    try {
      using namespace winrt::Windows::Media::Capture;
      using namespace winrt::Windows::Media::MediaProperties;
      using namespace winrt::Windows::Storage;
      MediaCaptureInitializationSettings settings;
      settings.StreamingCaptureMode(StreamingCaptureMode::Audio);
      state->capture = MediaCapture();
      state->capture.InitializeAsync(settings).get();
      auto folder = ApplicationData::Current().TemporaryFolder();
      state->file = folder.CreateFileAsync(
          L"moosiac-voice.wav", CreationCollisionOption::GenerateUniqueName).get();
      auto profile = MediaEncodingProfile::CreateWav(AudioEncodingQuality::High);
      state->capture.StartRecordToStorageFileAsync(profile, state->file).get();
      state->recording = true;
      result.Resolve(React::JSValue{nullptr});
    } catch (winrt::hresult_error const &error) {
      state->capture = nullptr;
      state->file = nullptr;
      result.Reject(React::ReactError{"MIC_UNAVAILABLE",
                                      winrt::to_string(error.message())});
    }
  }).detach();
}

void SynthModule::stopVoiceRecording(
    React::ReactPromise<React::JSValue> result) noexcept {
  auto state = m_voice;
  if (!state) {
    result.Reject(React::ReactError{"MIC_IDLE", "No recording is active."});
    return;
  }
  std::thread([state, result = std::move(result)]() mutable {
    winrt::init_apartment(winrt::apartment_type::multi_threaded);
    std::lock_guard lock(state->mutex);
    if (!state->recording) {
      result.Reject(React::ReactError{"MIC_IDLE", "No recording is active."});
      return;
    }
    try {
      state->capture.StopRecordAsync().get();
      std::string path = winrt::to_string(state->file.Path());
      state->recording = false;
      state->capture = nullptr;
      state->file = nullptr;
      result.Resolve(React::JSValue{path});
    } catch (winrt::hresult_error const &error) {
      state->recording = false;
      state->capture = nullptr;
      state->file = nullptr;
      result.Reject(React::ReactError{"MIC_STOP_FAILED",
                                      winrt::to_string(error.message())});
    }
  }).detach();
}

std::string SynthModule::bundledSoundfontPath() noexcept {
  return winrt::to_string(::MoosiacApp::AppDirectory()) +
      "\\soundfont\\FluidR3Mono_GM.sf3";
}

void SynthModule::outputDevices(React::ReactPromise<React::JSValue> result) noexcept {
  std::thread([result = std::move(result)]() mutable {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    React::JSValueArray devices;
    devices.emplace_back(React::JSValueObject{{"id", "default"}, {"name", "System default"}});
    ComPtr<IMMDeviceEnumerator> enumerator;
    ComPtr<IMMDeviceCollection> collection;
    HRESULT hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                                  IID_PPV_ARGS(&enumerator));
    if (SUCCEEDED(hr)) hr = enumerator->EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE, &collection);
    if (SUCCEEDED(hr)) {
      UINT count = 0;
      collection->GetCount(&count);
      for (UINT i = 0; i < count; ++i) {
        ComPtr<IMMDevice> device;
        if (FAILED(collection->Item(i, &device))) continue;
        LPWSTR id = nullptr;
        if (FAILED(device->GetId(&id))) continue;
        std::string name = winrt::to_string(winrt::hstring{id});
        ComPtr<IPropertyStore> properties;
        if (SUCCEEDED(device->OpenPropertyStore(STGM_READ, &properties))) {
          PROPVARIANT value;
          PropVariantInit(&value);
          if (SUCCEEDED(properties->GetValue(PKEY_Device_FriendlyName, &value)) && value.vt == VT_LPWSTR)
            name = winrt::to_string(winrt::hstring{value.pwszVal});
          PropVariantClear(&value);
        }
        devices.emplace_back(React::JSValueObject{{"id", winrt::to_string(winrt::hstring{id})}, {"name", name}});
        CoTaskMemFree(id);
      }
    }
    result.Resolve(React::JSValue{std::move(devices)});
    CoUninitialize();
  }).detach();
}

std::string SynthModule::selectedOutputDevice() noexcept {
  if (!m_state) return "default";
  std::lock_guard lock(m_state->mutex);
  return m_state->outputDeviceId.empty() ? "default" : m_state->outputDeviceId;
}

void SynthModule::setOutputDevice(std::string deviceId,
                                  React::ReactPromise<React::JSValue> result) noexcept {
  if (!m_state) m_state = std::make_shared<WindowsSynthState>();
  auto state = m_state;
  std::thread([state, deviceId = std::move(deviceId), result = std::move(result)]() mutable {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    std::lock_guard lock(state->mutex);
    const std::string chosen = deviceId == "default" ? "" : deviceId;
    // Always resolve System default again: an RDP connection can replace the
    // endpoint without changing the selected logical device id.
    const std::string previous = state->outputDeviceId;
    for (auto &instance : state->instances) closeOutput(*instance);
    std::string error;
    bool opened = true;
    for (auto &instance : state->instances) {
      if (!openOutput(*instance, chosen, error)) { opened = false; break; }
      std::lock_guard synthLock(instance->synthMutex);
      tsf_set_volume(instance->synth, state->initialGain * static_cast<float>(state->masterVolume));
    }
    if (!opened) {
      for (auto &instance : state->instances) closeOutput(*instance);
      for (auto &instance : state->instances) {
        std::string ignored;
        openOutput(*instance, previous, ignored);
        std::lock_guard synthLock(instance->synthMutex);
        tsf_set_volume(instance->synth, state->initialGain * static_cast<float>(state->masterVolume));
      }
      result.Reject(React::ReactError{"OUTPUT_UNAVAILABLE", error});
    } else {
      state->outputDeviceId = chosen;
      result.Resolve(React::JSValue{nullptr});
    }
    CoUninitialize();
  }).detach();
}

void SynthModule::initialize(std::string soundfontUri, double instanceCount,
                             React::JSValueObject settings,
                             React::ReactPromise<React::JSValue> result) noexcept {
  if (!m_state) m_state = std::make_shared<WindowsSynthState>();
  auto state = m_state;
  std::thread([state, soundfontUri = std::move(soundfontUri), instanceCount,
               settings = std::move(settings), result = std::move(result)]() mutable {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    const std::string path =
        soundfontUri.rfind("file://", 0) == 0 ? soundfontUri.substr(7) : soundfontUri;
    const auto requestedPrograms = programMaskFromSettings(settings);
    // Decoded before the lock is taken: JS reads `currentTime` and
    // `selectedOutputDevice` synchronously, and while the decode held the lock
    // the JS thread — the whole UI — waited for it.
    bool decoded;
    {
      std::lock_guard lock(state->mutex);
      decoded = state->font && state->fontPath == path &&
          state->programs == requestedPrograms;
    }
    tsf *loaded = decoded ? nullptr :
        tsf_load_filename_programs(path.c_str(), requestedPrograms.data());
    if (!decoded && !loaded) {
      result.Reject(React::ReactError{"SYNTH_INIT", "Could not decode the score's SoundFont instruments."});
      CoUninitialize();
      return;
    }
    std::lock_guard lock(state->mutex);
    if (loaded) {
      for (auto &instance : state->instances) closeInstance(*instance);
      state->instances.clear();
      state->adoptFont(loaded, path, requestedPrograms);
      state->clockOffset = 0;
    }
    state->soundfontPath = path;
    state->targetInstanceCount = static_cast<size_t>(std::max(0.0, instanceCount));
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
    state->targetInstanceCount = std::max(state->targetInstanceCount,
        static_cast<size_t>(std::max(0.0, count)));
    result.Resolve(React::JSValue{nullptr});
    CoUninitialize();
  }).detach();
}

void SynthModule::setPrograms(React::JSValueArray melodicPrograms,
                              React::JSValueArray percussionPrograms,
                              React::ReactPromise<React::JSValue> result) noexcept {
  if (!m_state) {
    result.Reject(React::ReactError{"SYNTH_INIT", "Synthesizer is not initialized."});
    return;
  }
  auto state = m_state;
  std::array<unsigned char, 256> requested{};
  auto addPrograms = [&requested](const React::JSValueArray &values, size_t offset) {
    for (const auto &value : values) {
      const int program = value.AsInt32();
      if (program >= 0 && program < 128) requested[offset + program] = 1;
    }
  };
  addPrograms(melodicPrograms, 0);
  addPrograms(percussionPrograms, 128);
  if (std::none_of(requested.begin(), requested.end(), [](unsigned char used) { return used != 0; })) {
    requested[0] = 1;
    requested[128] = 1;
  }

  std::thread([state, requested, result = std::move(result)]() mutable {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    std::string path;
    size_t instanceCount = 0;
    {
      std::lock_guard lock(state->mutex);
      if (state->programs == requested) {
        result.Resolve(React::JSValue{nullptr});
        CoUninitialize();
        return;
      }
      path = state->fontPath;
      instanceCount = state->targetInstanceCount;
    }

    // Decode the changed score's presets before interrupting the current audio.
    tsf *loaded = tsf_load_filename_programs(path.c_str(), requested.data());
    if (!loaded) {
      result.Reject(React::ReactError{"SYNTH_PROGRAMS", "Could not decode the score's SoundFont instruments."});
      CoUninitialize();
      return;
    }

    std::lock_guard lock(state->mutex);
    if (state->programs == requested) {
      tsf_close(loaded);
      result.Resolve(React::JSValue{nullptr});
      CoUninitialize();
      return;
    }
    double oldTime = state->clockOffset;
    if (!state->instances.empty() && state->instances.front()->sampleRate > 0) {
      oldTime += state->instances.front()->renderedSamples.load() /
          state->instances.front()->sampleRate;
    }
    for (auto &instance : state->instances) closeInstance(*instance);
    state->instances.clear();
    state->adoptFont(loaded, path, requested);
    state->clockOffset = oldTime;
    std::string error;
    while (state->instances.size() < instanceCount) {
      if (!state->addInstance(error)) {
        result.Reject(React::ReactError{"SYNTH_PROGRAMS", error});
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
  return m_state->clockOffset + (m_state->instances.empty() ? 0 :
      m_state->instances.front()->renderedSamples.load() / m_state->instances.front()->sampleRate);
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
  std::lock_guard synthLock(instance.synthMutex);
  const auto start = instance.renderedSamples.load() + static_cast<uint64_t>(std::max(0.0, delaySeconds) * instance.sampleRate);
  const auto duration = std::max<uint64_t>(1, static_cast<uint64_t>(std::max(0.0, durationSeconds) * instance.sampleRate));
  insertEvent(instance.events, {start, true, static_cast<int>(channel), static_cast<int>(midi), static_cast<float>(velocity) / 127.0f});
  insertEvent(instance.events, {start + duration, false, static_cast<int>(channel), static_cast<int>(midi), 0});
}

void SynthModule::noteOn(double index, double channel, double midi, double velocity) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); if (index >= 0 && index < m_state->instances.size()) { std::lock_guard synthLock(m_state->instances[index]->synthMutex); tsf_channel_note_on(m_state->instances[index]->synth, static_cast<int>(channel), static_cast<int>(midi), static_cast<float>(velocity) / 127.0f); } }
void SynthModule::noteOff(double index, double channel, double midi) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); if (index >= 0 && index < m_state->instances.size()) { std::lock_guard synthLock(m_state->instances[index]->synthMutex); tsf_channel_note_off(m_state->instances[index]->synth, static_cast<int>(channel), static_cast<int>(midi)); } }
void SynthModule::programSelect(double index, double channel, double program) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); if (index >= 0 && index < m_state->instances.size() && static_cast<int>(channel) != kPercussionChannel) { std::lock_guard synthLock(m_state->instances[index]->synthMutex); tsf_channel_set_presetnumber(m_state->instances[index]->synth, static_cast<int>(channel), static_cast<int>(program), 0); } }
void SynthModule::setChannelPercussion(double index, double channel, double kit) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); if (index >= 0 && index < m_state->instances.size()) { std::lock_guard synthLock(m_state->instances[index]->synthMutex); auto *s = m_state->instances[index]->synth; tsf_channel_set_bank(s, static_cast<int>(channel), kDrumBank); tsf_channel_set_presetnumber(s, static_cast<int>(channel), static_cast<int>(kit < 0 ? kStandardKit : kit), 1); } }
void SynthModule::controlChange(double index, double channel, double control, double value) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); if (index >= 0 && index < m_state->instances.size()) { std::lock_guard synthLock(m_state->instances[index]->synthMutex); tsf_channel_midi_control(m_state->instances[index]->synth, static_cast<int>(channel), static_cast<int>(control), static_cast<int>(value)); } }
void SynthModule::cancelScheduledOn(double index) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); if (index >= 0 && index < m_state->instances.size()) { std::lock_guard synthLock(m_state->instances[index]->synthMutex); m_state->instances[index]->events.clear(); } }
void SynthModule::allSoundOff() noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); for (auto &i : m_state->instances) { std::lock_guard synthLock(i->synthMutex); i->events.clear(); tsf_note_off_all(i->synth); } }
void SynthModule::setInterpolation(double order) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); m_state->interpolation = static_cast<int>(order); for (auto &i : m_state->instances) { std::lock_guard synthLock(i->synthMutex); tsf_set_interpolation(i->synth, static_cast<int>(order)); } }
void SynthModule::setMasterVolume(double volume) noexcept { if (!m_state) return; std::lock_guard lock(m_state->mutex); m_state->masterVolume = volume; for (auto &i : m_state->instances) { std::lock_guard synthLock(i->synthMutex); tsf_set_volume(i->synth, m_state->initialGain * static_cast<float>(volume)); } }
void SynthModule::dispose() noexcept {
  // Dropping the state also releases the decoded SoundFont once any in-flight
  // loading call finishes. Keeping m_state alive held its sample buffer in RAM
  // after the player had disposed every synth instance.
  auto state = std::move(m_state);
  if (!state) return;
  std::lock_guard lock(state->mutex);
  for (auto &instance : state->instances) closeInstance(*instance);
  state->instances.clear();
}

} // namespace winrt::MoosiacRN::implementation

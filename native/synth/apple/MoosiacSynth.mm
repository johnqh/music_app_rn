/**
 * libfluidsynth, driven the way the web drives it.
 *
 * The web plays FluidR3 through fluidsynth compiled to WebAssembly in an
 * AudioWorklet. React Native has neither, so the Mac played per-note MP3
 * renderings instead — every instrument decoded before the first note, and a
 * clock taken from JavaScript timers. This is the same synthesizer, natively:
 * the same font, the same settings, and a clock taken from the audio itself.
 *
 * It is a synth, not a player. `@sudobility/music_player`'s
 * `NativeSynthBackend` and the shared scheduler own the transport; this owns
 * sound and a clock, addressed by (instance, channel) exactly like the web
 * host. Every method is synchronous: a note scheduled `delay` seconds from the
 * clock the caller just read must not pick up a bridge hop in between.
 */
#import "MoosiacSynth.h"

#import <Foundation/Foundation.h>
#include <fluidsynth.h>

#include <mutex>
#include <vector>

static const int kDrumBank = 128;
static const int kStandardKit = 0;
static const int kPercussionChannel = 9;

namespace {

struct Instance {
  fluid_settings_t *settings = nullptr;
  fluid_synth_t *synth = nullptr;
  fluid_audio_driver_t *driver = nullptr;
  fluid_sequencer_t *sequencer = nullptr;
  fluid_seq_id_t destination = -1;
  int sfontId = -1;
};

void destroyInstance(Instance &instance)
{
  if (instance.sequencer) {
    delete_fluid_sequencer(instance.sequencer);
  }
  if (instance.driver) {
    delete_fluid_audio_driver(instance.driver);
  }
  if (instance.synth) {
    delete_fluid_synth(instance.synth);
  }
  if (instance.settings) {
    delete_fluid_settings(instance.settings);
  }
  instance = Instance{};
}

} // namespace

@implementation MoosiacSynth {
  std::mutex _mutex;
  std::vector<Instance> _instances;
  NSString *_soundfontPath;
  NSDictionary *_settings;
  double _initialGain;
  double _masterVolume;
  int _interpolation;
}

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    _initialGain = 0.35;
    _masterVolume = 1;
    _interpolation = -1;
  }
  return self;
}

- (void)invalidate
{
  [self disposeAll];
}

- (void)dealloc
{
  [self disposeAll];
}

- (void)disposeAll
{
  std::lock_guard<std::mutex> lock(_mutex);
  for (auto &instance : _instances) {
    destroyInstance(instance);
  }
  _instances.clear();
}

/** One synth with its own audio output and a sequencer timed by that output's samples. */
- (BOOL)addInstance:(NSString **)error
{
  Instance instance;
  instance.settings = new_fluid_settings();
  fluid_settings_setint(instance.settings, "synth.midi-channels", [_settings[@"midiChannelCount"] intValue] ?: 256);
  fluid_settings_setint(instance.settings, "synth.polyphony", [_settings[@"polyphony"] intValue] ?: 2048);
  fluid_settings_setnum(instance.settings, "synth.gain", _initialGain * _masterVolume);
  fluid_settings_setint(instance.settings, "synth.chorus.active", [_settings[@"chorusActive"] boolValue] ? 1 : 0);
  fluid_settings_setint(instance.settings, "synth.reverb.active", [_settings[@"reverbActive"] boolValue] ? 1 : 0);
  // The web host's, stated rather than inherited: see `synth-host.ts`.
  fluid_settings_setstr(instance.settings, "synth.midi-bank-select", "gs");
  fluid_settings_setint(instance.settings, "synth.min-note-length", 10);
  fluid_settings_setstr(instance.settings, "audio.driver", "coreaudio");

  instance.synth = new_fluid_synth(instance.settings);
  if (!instance.synth) {
    *error = @"Could not create a fluidsynth synth.";
    destroyInstance(instance);
    return NO;
  }
  instance.sfontId = fluid_synth_sfload(instance.synth, _soundfontPath.fileSystemRepresentation, 1);
  if (instance.sfontId == FLUID_FAILED) {
    *error = [NSString stringWithFormat:@"Could not load the soundfont at %@.", _soundfontPath];
    destroyInstance(instance);
    return NO;
  }
  if (_interpolation >= 0) {
    fluid_synth_set_interp_method(instance.synth, -1, _interpolation);
  }
  // Sample-timed: the clock advances as audio is rendered, which is what a
  // playhead has to agree with.
  instance.sequencer = new_fluid_sequencer2(0);
  fluid_sequencer_set_time_scale(instance.sequencer, 1000);
  instance.destination = fluid_sequencer_register_fluidsynth(instance.sequencer, instance.synth);
  instance.driver = new_fluid_audio_driver(instance.settings, instance.synth);
  if (!instance.driver) {
    *error = @"Could not open the audio output.";
    destroyInstance(instance);
    return NO;
  }
  _instances.push_back(instance);
  return YES;
}

- (Instance *)instanceAt:(int)index
{
  return index >= 0 && index < (int)_instances.size() ? &_instances[index] : nullptr;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(isSupported)
{
  return @YES;
}

/** The font bundled with the app, as a file path. */
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(bundledSoundfontPath)
{
  NSString *path = [[NSBundle mainBundle] pathForResource:@"FluidR3Mono_GM" ofType:@"sf3"];
  return path ?: (id)[NSNull null];
}

RCT_EXPORT_METHOD(initialize:(NSString *)soundfontUri
                  instanceCount:(double)instanceCount
                  settings:(NSDictionary *)settings
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    std::lock_guard<std::mutex> lock(self->_mutex);
    NSString *path = [soundfontUri hasPrefix:@"file://"] ? [NSURL URLWithString:soundfontUri].path : soundfontUri;
    if (self->_instances.size() > 0 && [path isEqualToString:self->_soundfontPath]) {
      // Already up; just grow the pool.
    } else {
      for (auto &instance : self->_instances) {
        destroyInstance(instance);
      }
      self->_instances.clear();
      self->_soundfontPath = path;
      self->_settings = settings;
      if (settings[@"initialGain"]) {
        self->_initialGain = [settings[@"initialGain"] doubleValue];
      }
    }
    NSString *error = nil;
    while ((int)self->_instances.size() < (int)instanceCount) {
      if (![self addInstance:&error]) {
        reject(@"synth_init", error, nil);
        return;
      }
    }
    resolve(nil);
  });
}

RCT_EXPORT_METHOD(ensureInstances:(double)count
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    std::lock_guard<std::mutex> lock(self->_mutex);
    NSString *error = nil;
    while ((int)self->_instances.size() < (int)count) {
      if (![self addInstance:&error]) {
        reject(@"synth_instances", error, nil);
        return;
      }
    }
    resolve(nil);
  });
}

/** Seconds, from the first instance's sample-timed sequencer. */
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(currentTime)
{
  std::lock_guard<std::mutex> lock(_mutex);
  Instance *first = [self instanceAt:0];
  return @(first ? fluid_sequencer_get_tick(first->sequencer) / 1000.0 : 0.0);
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(outputLatency)
{
  std::lock_guard<std::mutex> lock(_mutex);
  Instance *first = [self instanceAt:0];
  if (!first) {
    return @0;
  }
  int periodSize = 0, periods = 0;
  double sampleRate = 44100;
  fluid_settings_getint(first->settings, "audio.period-size", &periodSize);
  fluid_settings_getint(first->settings, "audio.periods", &periods);
  fluid_settings_getnum(first->settings, "synth.sample-rate", &sampleRate);
  return @(sampleRate > 0 ? (double)periodSize * MAX(1, periods) / sampleRate : 0);
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(noteAt:(double)index
                                       channel:(double)channel
                                       midi:(double)midi
                                       velocity:(double)velocity
                                       delaySeconds:(double)delaySeconds
                                       durationSeconds:(double)durationSeconds)
{
  std::lock_guard<std::mutex> lock(_mutex);
  Instance *instance = [self instanceAt:(int)index];
  if (!instance) {
    return nil;
  }
  fluid_event_t *event = new_fluid_event();
  fluid_event_set_source(event, -1);
  fluid_event_set_dest(event, instance->destination);
  // Never zero: a note of no length may not sound (see the web host).
  unsigned int duration = (unsigned int)MAX(1, llround(durationSeconds * 1000));
  fluid_event_note(event, (int)channel, (short)midi, (short)velocity, duration);
  unsigned int at = fluid_sequencer_get_tick(instance->sequencer) + (unsigned int)MAX(0, llround(delaySeconds * 1000));
  fluid_sequencer_send_at(instance->sequencer, event, at, 1);
  delete_fluid_event(event);
  return nil;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(noteOn:(double)index channel:(double)channel midi:(double)midi velocity:(double)velocity)
{
  std::lock_guard<std::mutex> lock(_mutex);
  if (Instance *instance = [self instanceAt:(int)index]) {
    fluid_synth_noteon(instance->synth, (int)channel, (int)midi, (int)velocity);
  }
  return nil;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(noteOff:(double)index channel:(double)channel midi:(double)midi)
{
  std::lock_guard<std::mutex> lock(_mutex);
  if (Instance *instance = [self instanceAt:(int)index]) {
    fluid_synth_noteoff(instance->synth, (int)channel, (int)midi);
  }
  return nil;
}

/** A melodic program — never on the drum channel, where it silences the kit (see the web host). */
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(programSelect:(double)index channel:(double)channel program:(double)program)
{
  std::lock_guard<std::mutex> lock(_mutex);
  Instance *instance = [self instanceAt:(int)index];
  if (!instance || (int)channel == kPercussionChannel) {
    return nil;
  }
  fluid_synth_set_channel_type(instance->synth, (int)channel, CHANNEL_TYPE_MELODIC);
  fluid_synth_program_select(instance->synth, (int)channel, instance->sfontId, 0, (int)program);
  return nil;
}

/** Drums: the standard kit first, so a kit the font lacks falls back to drums rather than a piano. */
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(setChannelPercussion:(double)index channel:(double)channel kit:(double)kit)
{
  std::lock_guard<std::mutex> lock(_mutex);
  Instance *instance = [self instanceAt:(int)index];
  if (!instance) {
    return nil;
  }
  fluid_synth_set_channel_type(instance->synth, (int)channel, CHANNEL_TYPE_DRUM);
  fluid_synth_program_select(instance->synth, (int)channel, instance->sfontId, kDrumBank, kStandardKit);
  if (kit >= 0 && (int)kit != kStandardKit) {
    fluid_synth_program_select(instance->synth, (int)channel, instance->sfontId, kDrumBank, (int)kit);
  }
  return nil;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(controlChange:(double)index channel:(double)channel control:(double)control value:(double)value)
{
  std::lock_guard<std::mutex> lock(_mutex);
  if (Instance *instance = [self instanceAt:(int)index]) {
    fluid_synth_cc(instance->synth, (int)channel, (int)control, (int)value);
  }
  return nil;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(cancelScheduledOn:(double)index)
{
  std::lock_guard<std::mutex> lock(_mutex);
  if (Instance *instance = [self instanceAt:(int)index]) {
    fluid_sequencer_remove_events(instance->sequencer, -1, -1, -1);
  }
  return nil;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(allSoundOff)
{
  std::lock_guard<std::mutex> lock(_mutex);
  for (auto &instance : _instances) {
    fluid_sequencer_remove_events(instance.sequencer, -1, -1, -1);
    fluid_synth_all_sounds_off(instance.synth, -1);
  }
  return nil;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(setInterpolation:(double)order)
{
  std::lock_guard<std::mutex> lock(_mutex);
  _interpolation = (int)order;
  for (auto &instance : _instances) {
    fluid_synth_set_interp_method(instance.synth, -1, _interpolation);
  }
  return nil;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(setMasterVolume:(double)volume)
{
  std::lock_guard<std::mutex> lock(_mutex);
  _masterVolume = volume;
  for (auto &instance : _instances) {
    fluid_synth_set_gain(instance.synth, (float)(_initialGain * _masterVolume));
  }
  return nil;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(dispose)
{
  [self disposeAll];
  return nil;
}

@end

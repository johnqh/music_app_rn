#pragma once

#include "pch.h"
#include "NativeModules.h"
#include <winrt/Microsoft.ReactNative.h>

#include <memory>

namespace winrt::MoosiacRN::implementation {

struct WindowsSynthState;

REACT_MODULE(MoosiacSynth)
struct SynthModule {
  REACT_METHOD(isSupported)
  bool isSupported() noexcept;

  REACT_METHOD(bundledSoundfontPath)
  std::string bundledSoundfontPath() noexcept;

  REACT_METHOD(initialize)
  void initialize(std::string soundfontUri, double instanceCount,
                  React::JSValueObject settings,
                  React::ReactPromise<React::JSValue> result) noexcept;

  REACT_METHOD(ensureInstances)
  void ensureInstances(double count,
                       React::ReactPromise<React::JSValue> result) noexcept;

  REACT_METHOD(currentTime)
  double currentTime() noexcept;

  REACT_METHOD(outputLatency)
  double outputLatency() noexcept;

  REACT_METHOD(noteAt)
  void noteAt(double index, double channel, double midi, double velocity,
              double delaySeconds, double durationSeconds) noexcept;

  REACT_METHOD(noteOn)
  void noteOn(double index, double channel, double midi, double velocity) noexcept;

  REACT_METHOD(noteOff)
  void noteOff(double index, double channel, double midi) noexcept;

  REACT_METHOD(programSelect)
  void programSelect(double index, double channel, double program) noexcept;

  REACT_METHOD(setChannelPercussion)
  void setChannelPercussion(double index, double channel, double kit) noexcept;

  REACT_METHOD(controlChange)
  void controlChange(double index, double channel, double control, double value) noexcept;

  REACT_METHOD(cancelScheduledOn)
  void cancelScheduledOn(double index) noexcept;

  REACT_METHOD(allSoundOff)
  void allSoundOff() noexcept;

  REACT_METHOD(setInterpolation)
  void setInterpolation(double order) noexcept;

  REACT_METHOD(setMasterVolume)
  void setMasterVolume(double volume) noexcept;

  REACT_METHOD(dispose)
  void dispose() noexcept;

 private:
  std::shared_ptr<WindowsSynthState> m_state;
};

} // namespace winrt::MoosiacRN::implementation

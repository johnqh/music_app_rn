#!/bin/bash
#
# Builds apple/Frameworks/FluidSynth.xcframework for iOS and macOS, with SF3
# support: an iPhone/iPad slice, a simulator slice and a universal (Apple
# silicon + Intel) macOS slice.
#
# macOS used to link Homebrew's libfluidsynth instead. That builds on the Mac
# it was installed on and nowhere else: Xcode Cloud has no Homebrew FluidSynth
# ("'fluidsynth.h' file not found"), Homebrew's copy has no Intel slice for a
# universal archive, and a shipped app would look for a library under
# /opt/homebrew on its user's Mac. Bundled, the Mac app carries its own, as the
# iOS app always has.
#
# The XCFramework FluidSynth publishes with each release is built with
# `-Denable-libsndfile=OFF` (its own contrib/ios_build.sh). Without libsndfile
# FluidSynth reads uncompressed SF2 and nothing else, and the soundfont this
# app bundles, FluidR3Mono_GM.sf3, is Ogg Vorbis compressed — so
# `fluid_synth_sfload` failed on every iPhone and iPad, and iOS fell back to
# decoding MP3 sample packs in JavaScript when Play was pressed.
#
# This builds the same framework with the one option turned on, and the
# libraries it needs built for iOS first:
#
#   libogg -> libvorbis, FLAC, Opus -> libsndfile -> FluidSynth
#
# Only Vorbis is wanted — it is what SF3 is compressed with — but libsndfile
# offers its Ogg codecs as one switch: without FLAC and Opus present too it
# turns all of them off, Vorbis included, so they are built to be allowed it.
#
# They are static and linked INTO the framework, so what ships is still one
# dynamic FluidSynth.framework per slice, as before, and the podspec does not
# change. FluidSynth and libsndfile are LGPL-2.1; a dynamic framework the app
# links against is how an app may use them. The Xiph libraries are BSD.
#
# Everything else matches the official script: the C++11 OS layer rather than
# glib, CoreAudio and CoreMIDI, no network, no file renderer.
#
# Usage:   native/synth/scripts/build-fluidsynth-apple.sh
# Needs:   Xcode, cmake (`brew install cmake`), git, curl
# Env:     WORK   where to download and build (default: a fresh temp dir)
#          IOS_DEPLOYMENT_TARGET   (default 15.0, the podspec's)
#          MACOS_DEPLOYMENT_TARGET (default 14.0, the podspec's)
#
set -euo pipefail

OGG_VERSION=1.3.5
VORBIS_VERSION=1.3.7
FLAC_VERSION=1.4.3
OPUS_VERSION=1.5.2
SNDFILE_VERSION=1.2.2
FLUIDSYNTH_VERSION=2.6.0

# Release archives are checked before they are built: what is linked into the
# app has to be what was asked for.
OGG_SHA256=0eb4b4b9420a0f51db142ba3f9c64b333f826532dc0f48c6410ae51f4799b664
VORBIS_SHA256=0e982409a9c3fc82ee06e08205b1355e5c6aa4c36bca58146ef399621b0ce5ab
FLAC_SHA256=6c58e69cd22348f441b861092b825e591d0b822e106de6eb0ee4d05d27205b70
OPUS_SHA256=65c1d2f78b9f2fb20082c38cbe47c951ad5839345876e46941612ee87f9a7ce1
SNDFILE_SHA256=3799ca9924d3125038880367bf1468e53a1b7e3686a934f098b7e1d286cdb80e

IOS_DEPLOYMENT_TARGET="${IOS_DEPLOYMENT_TARGET:-15.0}"
MACOS_DEPLOYMENT_TARGET="${MACOS_DEPLOYMENT_TARGET:-14.0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="${SCRIPT_DIR}/../apple/Frameworks/FluidSynth.xcframework"
WORK="${WORK:-$(mktemp -d)}"
SRC="${WORK}/src"
JOBS="$(sysctl -n hw.ncpu)"

mkdir -p "${SRC}"
echo "Building in ${WORK}"

fetch() {
  local url="$1" sha="$2" file
  file="${SRC}/$(basename "${url}")"
  [ -f "${file}" ] || curl -fsSL -o "${file}" "${url}"
  echo "${sha}  ${file}" | shasum -a 256 -c - >/dev/null
  tar -xf "${file}" -C "${SRC}"
}

fetch "https://github.com/xiph/ogg/releases/download/v${OGG_VERSION}/libogg-${OGG_VERSION}.tar.gz" "${OGG_SHA256}"
fetch "https://github.com/xiph/vorbis/releases/download/v${VORBIS_VERSION}/libvorbis-${VORBIS_VERSION}.tar.gz" "${VORBIS_SHA256}"
fetch "https://github.com/xiph/flac/releases/download/${FLAC_VERSION}/flac-${FLAC_VERSION}.tar.xz" "${FLAC_SHA256}"
fetch "https://github.com/xiph/opus/releases/download/v${OPUS_VERSION}/opus-${OPUS_VERSION}.tar.gz" "${OPUS_SHA256}"
fetch "https://github.com/libsndfile/libsndfile/releases/download/${SNDFILE_VERSION}/libsndfile-${SNDFILE_VERSION}.tar.xz" "${SNDFILE_SHA256}"

# A clone rather than the release archive: FluidSynth's C++11 layer needs its
# `gcem` submodule, and an archive of a tag carries submodules as empty folders.
if [ ! -d "${SRC}/fluidsynth" ]; then
  git clone --quiet --depth 1 --branch "v${FLUIDSYNTH_VERSION}" \
    --recurse-submodules --shallow-submodules \
    https://github.com/FluidSynth/fluidsynth.git "${SRC}/fluidsynth"
fi

# One slice: the three libraries into a prefix, then the framework against it.
#   $1 name   $2 sdk   $3 architectures (";"-separated)
#   $4 CMake system name (iOS, or Darwin for macOS)   $5 deployment target
build_slice() {
  local name="$1" sdk="$2" archs="$3" system="$4" deployment="$5"
  local build="${WORK}/${name}" prefix="${WORK}/${name}/prefix"
  mkdir -p "${prefix}"

  # pkg-config answers for the Mac this runs on. Left alone it offered
  # Homebrew's own libsndfile — a macOS library — to a build for an iPad, and
  # would hand a macOS slice Homebrew's arm64-only copies.
  export PKG_CONFIG_LIBDIR="${prefix}/lib/pkgconfig"
  unset PKG_CONFIG_PATH

  local platform=(
    -DCMAKE_SYSTEM_NAME="${system}"
    -DCMAKE_OSX_SYSROOT="${sdk}"
    -DCMAKE_OSX_ARCHITECTURES="${archs}"
    -DCMAKE_OSX_DEPLOYMENT_TARGET="${deployment}"
    -DCMAKE_BUILD_TYPE=Release
    -DCMAKE_INSTALL_PREFIX="${prefix}"
    -DCMAKE_PREFIX_PATH="${prefix}"
    # Cross-compiling, CMake looks for packages only under the SDK unless it
    # is told the prefix is part of the target's world too.
    -DCMAKE_FIND_ROOT_PATH="${prefix}"
    # Each library is found by the description it installed of itself, which
    # names what it was built with and what it links. FluidSynth's fallback
    # finder knows neither: it found libsndfile, reported "Support for SF3
    # files: no", and left FLAC and Opus off the link line.
    -DCMAKE_FIND_PACKAGE_PREFER_CONFIG=ON
    # The archives predate CMake 4, which refuses their minimum version.
    -DCMAKE_POLICY_VERSION_MINIMUM=3.5
  )
  local static=(
    -DBUILD_SHARED_LIBS=OFF
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON
    -DBUILD_TESTING=OFF
  )

  echo "== ${name}: libogg"
  cmake -S "${SRC}/libogg-${OGG_VERSION}" -B "${build}/ogg" \
    "${platform[@]}" "${static[@]}" -DINSTALL_DOCS=OFF >/dev/null
  cmake --build "${build}/ogg" --target install -j "${JOBS}" >/dev/null

  echo "== ${name}: libvorbis"
  cmake -S "${SRC}/libvorbis-${VORBIS_VERSION}" -B "${build}/vorbis" \
    "${platform[@]}" "${static[@]}" >/dev/null
  cmake --build "${build}/vorbis" --target install -j "${JOBS}" >/dev/null

  echo "== ${name}: FLAC"
  cmake -S "${SRC}/flac-${FLAC_VERSION}" -B "${build}/flac" \
    "${platform[@]}" "${static[@]}" \
    -DBUILD_PROGRAMS=OFF -DBUILD_EXAMPLES=OFF -DBUILD_DOCS=OFF \
    -DBUILD_CXXLIBS=OFF -DINSTALL_MANPAGES=OFF -DWITH_OGG=ON >/dev/null
  cmake --build "${build}/flac" --target install -j "${JOBS}" >/dev/null

  echo "== ${name}: Opus"
  cmake -S "${SRC}/opus-${OPUS_VERSION}" -B "${build}/opus" \
    "${platform[@]}" "${static[@]}" \
    -DOPUS_BUILD_PROGRAMS=OFF -DOPUS_BUILD_TESTING=OFF >/dev/null
  cmake --build "${build}/opus" --target install -j "${JOBS}" >/dev/null

  # MP3 is its own switch, and off: no soundfont is compressed with it.
  echo "== ${name}: libsndfile"
  cmake -S "${SRC}/libsndfile-${SNDFILE_VERSION}" -B "${build}/sndfile" \
    "${platform[@]}" "${static[@]}" \
    -DBUILD_PROGRAMS=OFF -DBUILD_EXAMPLES=OFF -DENABLE_CPACK=OFF \
    -DENABLE_PACKAGE_CONFIG=ON -DINSTALL_PKGCONFIG_MODULE=OFF \
    -DINSTALL_MANPAGES=OFF -DENABLE_MPEG=OFF \
    -DCMAKE_DISABLE_FIND_PACKAGE_mpg123=ON >/dev/null
  cmake --build "${build}/sndfile" --target install -j "${JOBS}" >/dev/null

  echo "== ${name}: FluidSynth"
  cmake -S "${SRC}/fluidsynth" -B "${build}/fluidsynth" -G Xcode \
    "${platform[@]}" \
    -Dosal=cpp11 \
    -Denable-framework=ON \
    -Denable-libsndfile=ON \
    -Denable-coreaudio=ON \
    -Denable-threads=ON \
    -Denable-aufile=OFF -Denable-dbus=OFF -Denable-ladspa=OFF \
    -Denable-midishare=OFF -Denable-opensles=OFF -Denable-oboe=OFF \
    -Denable-oss=OFF -Denable-pipewire=OFF -Denable-portaudio=OFF \
    -Denable-pulseaudio=OFF -Denable-readline=OFF -Denable-sdl3=OFF \
    -Denable-systemd=OFF -Denable-waveout=OFF -Denable-network=OFF \
    -Denable-ipv6=OFF -Denable-openmp=OFF -Denable-jack=OFF \
    -Denable-alsa=OFF \
    -DCMAKE_MACOSX_BUNDLE=NO \
    -DBUILD_SHARED_LIBS=ON \
    -DCMAKE_XCODE_ATTRIBUTE_CODE_SIGNING_ALLOWED=NO \
    >"${build}/fluidsynth-configure.log" 2>&1 || {
    tail -40 "${build}/fluidsynth-configure.log" >&2
    exit 1
  }
  grep -i -E "SF3|libsndfile:" "${build}/fluidsynth-configure.log" || true

  # Said by the configure step, and worth stopping for: a framework built
  # without it looks identical until a soundfont fails to load on a device.
  grep -q -E "Support for SF3 files: +yes" "${build}/fluidsynth-configure.log" || {
    echo "FluidSynth was configured without SF3 support; see ${build}/fluidsynth-configure.log" >&2
    exit 1
  }

  xcodebuild -project "${build}/fluidsynth/FluidSynth.xcodeproj" \
    -target libfluidsynth -configuration Release -sdk "${sdk}" \
    build DEBUG_INFORMATION_FORMAT="dwarf-with-dsym" \
    GCC_GENERATE_DEBUGGING_SYMBOLS=YES >"${build}/fluidsynth-build.log" 2>&1 || {
    tail -40 "${build}/fluidsynth-build.log" >&2
    exit 1
  }
}

build_slice ios iphoneos "arm64" iOS "${IOS_DEPLOYMENT_TARGET}"
build_slice ios-simulator iphonesimulator "arm64;x86_64" iOS "${IOS_DEPLOYMENT_TARGET}"
build_slice macos macosx "arm64;x86_64" Darwin "${MACOS_DEPLOYMENT_TARGET}"

DEVICE="${WORK}/ios/fluidsynth/src/Release-iphoneos/FluidSynth.framework"
SIMULATOR="${WORK}/ios-simulator/fluidsynth/src/Release-iphonesimulator/FluidSynth.framework"
MACOS="${WORK}/macos/fluidsynth/src/Release/FluidSynth.framework"

# The check the official framework fails: Vorbis has to be in the binary —
# and on macOS in both architectures, or an Intel Mac cannot read SF3.
for framework in "${DEVICE}" "${SIMULATOR}" "${MACOS}"; do
  # Counted rather than `grep -q`: that stops reading at the first match,
  # `nm` dies writing to the closed pipe, and `pipefail` reports the death
  # as a failure — of a check that had just succeeded.
  symbols="$(nm "${framework}/FluidSynth" 2>/dev/null | grep -c "_vorbis_synthesis" || true)"
  [ "${symbols}" -gt 0 ] || {
    echo "No Vorbis decoder in ${framework}" >&2
    exit 1
  }
done

# A universal binary passes the check above if either half has Vorbis, so
# each macOS architecture is checked on its own.
for arch in arm64 x86_64; do
  symbols="$(nm -arch "${arch}" "${MACOS}/FluidSynth" 2>/dev/null | grep -c "_vorbis_synthesis" || true)"
  [ "${symbols}" -gt 0 ] || {
    echo "No Vorbis decoder in the ${arch} half of ${MACOS}" >&2
    exit 1
  }
done

rm -rf "${WORK}/FluidSynth.xcframework"
xcodebuild -create-xcframework \
  -framework "${DEVICE}" -debug-symbols "${DEVICE}.dSYM" \
  -framework "${SIMULATOR}" -debug-symbols "${SIMULATOR}.dSYM" \
  -framework "${MACOS}" -debug-symbols "${MACOS}.dSYM" \
  -output "${WORK}/FluidSynth.xcframework" >/dev/null

rm -rf "${OUTPUT}"
cp -R "${WORK}/FluidSynth.xcframework" "${OUTPUT}"
echo "Built ${OUTPUT}"
cat <<'NOTE'

The app does not link this folder. `@moosiac/synth` is a `file:` dependency,
so CocoaPods reads the COPY in node_modules, and Xcode keeps a copy of its
own. To put the new framework in the app:

  rm -rf node_modules/@moosiac/synth && bun install
  (cd ios && pod install) && (cd macos && pod install)
  find ~/Library/Developer/Xcode/DerivedData/MoosiacRN-*/Build/Products \
    -maxdepth 4 -name FluidSynth.framework -exec rm -rf {} +

Then rebuild, and check the binary inside the built app rather than trusting
the build: `nm <App>.app/Frameworks/FluidSynth.framework/FluidSynth | grep -c
vorbis_synthesis` is 0 for the framework that cannot read SF3.
NOTE

# Windows native synthesizer dependencies

`tsf.h` is TinySoundFont v0.9, licensed under the MIT license. Its complete
license text is included at the top of the header.

`stb_vorbis.c` is stb_vorbis v1.22, released into the public domain. Its
license notice is included at the top and bottom of the source file.

The decoder is compiled into `SynthModule.cpp` so the Windows package has no
runtime dependency on a separate SoundFont library. It is required because the
bundled `FluidR3Mono_GM.sf3` uses Ogg/Vorbis-compressed samples.

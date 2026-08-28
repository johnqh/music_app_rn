require('@testing-library/jest-native/extend-expect');

/*
  Longer than jest's five-second default.

  Rendering anything here starts i18next, which costs a couple of seconds the
  first time in a process — and a component test that renders twice can spend
  most of the default budget on that alone. The failure it causes is a timeout
  with nothing wrong in the test, which is the worst kind to debug.
*/
jest.setTimeout(20000);

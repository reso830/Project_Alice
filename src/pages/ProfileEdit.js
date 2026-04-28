let _container = null;

export function mount(container, { navigate } = {}) {
  void navigate;
  _container = container;
}

export function unmount() {
  _container?.replaceChildren();
  _container = null;
}

export const ProfileEdit = { mount, unmount };

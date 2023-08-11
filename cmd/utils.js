export const parseSemver = (val) => {
  const parts = val.split('.');

  let major = 0;
  let minor = 0;
  let patch = 0;
  let tag = '';
  let iter = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    switch (i) {
      case 0:
        major = parseInt(part, 10);
        break;
      case 1:
        minor = parseInt(part, 10);
        break;
      case 2: {
        const idx = part.indexOf('-');
        if (idx === -1) {
          patch = parseInt(part, 10);
        } else {
          patch = parseInt(part.substring(0, idx), 10);
          tag = part.substring(idx + 1);
        }
        break;
      }
      case 3:
        iter = parseInt(part, 10);
        break;
    }
  }

  return { major, minor, patch, tag, iter };
};

export const formatSemver = (v: ReturnType<typeof parseSemver>) => {
  const base = `${v.major}.${v.minor}.${v.patch}`;
  if (!v.tag) {
    return base;
  }
  return `${base}-${v.tag}.${v.iter}`;
};

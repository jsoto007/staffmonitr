export const formatPermissionLabel = (code: string, description?: string | null): string => {
  if (description && description.trim()) {
    return description.trim();
  }

  const cleaned = code.replace(/[_\.]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return code;
  }

  return cleaned
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

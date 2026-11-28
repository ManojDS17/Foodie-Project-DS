export const getSavedRowsPerPage = (defaultValue = 10): number => {
  try {
    const saved = localStorage.getItem('foodie_rows_per_page');
    if (saved) {
      const parsed = Number(saved);
      if ([5, 10, 20, 25, 50, 100].includes(parsed)) return parsed;
    }
  } catch {
    return defaultValue;
  }
  return defaultValue;
};

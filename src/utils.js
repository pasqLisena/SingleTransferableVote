const EXCEL_EPOCH_OFFSET = 25569;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function timestampToDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(Math.round((value - EXCEL_EPOCH_OFFSET) * MS_PER_DAY));
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    const numericValue = Number(trimmedValue);
    if (Number.isFinite(numericValue)) {
      return new Date(Math.round((numericValue - EXCEL_EPOCH_OFFSET) * MS_PER_DAY));
    }

    const parsedDate = new Date(trimmedValue);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return null;
}


export { timestampToDate };

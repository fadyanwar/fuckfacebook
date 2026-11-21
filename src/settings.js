const DEFAULT_LIMIT_MINUTES = 60;

function getLimitMinutes(value) {
  return Number.isInteger(value) && value >= 1 && value <= 1440
    ? value
    : DEFAULT_LIMIT_MINUTES;
}

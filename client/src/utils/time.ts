const HOURS_PER_DAY = 24;
const MINUTES_PER_DAY = HOURS_PER_DAY * 60;

export const clampMinutes = (value: number) =>
  Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(value)));

export const minutesToTimeInput = (value: number) => {
  const normalized = clampMinutes(value);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const timeInputToMinutes = (time: string) => {
  const [hours = '0', minutes = '0'] = time.split(':');
  const parsedHours = Number.parseInt(hours, 10);
  const parsedMinutes = Number.parseInt(minutes, 10);
  if (Number.isNaN(parsedHours) || Number.isNaN(parsedMinutes)) {
    return 0;
  }
  return clampMinutes(parsedHours * 60 + parsedMinutes);
};

export const formatMinutesLabel = (value: number) => {
  const normalized = clampMinutes(value % MINUTES_PER_DAY);
  const hours = Math.floor(normalized / 60) % HOURS_PER_DAY;
  const minutes = normalized % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

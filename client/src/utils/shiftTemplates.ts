import type { KidDetails, ShiftEvent, ShiftTemplate } from '../types';
import { minutesOfDay, timeInputToMinutes } from './time';

export const shiftMatchesTemplate = (shift: ShiftEvent, template: ShiftTemplate) => {
  const shiftStart = minutesOfDay(new Date(shift.start_time));
  const templateStart = timeInputToMinutes(template.start_time);
  const templateEnd = timeInputToMinutes(template.end_time);
  if (templateStart === templateEnd) {
    return true;
  }
  if (templateStart < templateEnd) {
    return shiftStart >= templateStart && shiftStart < templateEnd;
  }
  return shiftStart >= templateStart || shiftStart < templateEnd;
};

export const computeStaffNeeded = (
  shift: ShiftEvent,
  template: ShiftTemplate | null,
): { target: number; ratioLabel: string } => {
  const ratioStaff = template?.ratio_staff && template.ratio_staff > 0 ? template.ratio_staff : 1;
  const ratioKids = template?.ratio_kids && template.ratio_kids > 0 ? template.ratio_kids : 4;
  const kids: KidDetails[] = shift.kids ?? [];
  const oneOnOneCount = kids.filter((kid) => kid.requiresOneOnOne || kid.ratio === '1:1').length;
  const groupableKids = Math.max(kids.length - oneOnOneCount, 0);
  const baseStaff = ratioKids > 0 ? Math.ceil(groupableKids / ratioKids) * ratioStaff : ratioStaff;
  const oneOnOneStaff = oneOnOneCount * ratioStaff;
  const templateTarget = Math.max(baseStaff + oneOnOneStaff, ratioStaff);
  const ratioMin = shift.ratio_min ?? 0;
  const target = ratioMin > 0 ? Math.max(ratioMin, templateTarget) : templateTarget;
  return { target, ratioLabel: `${ratioStaff}:${ratioKids}` };
};

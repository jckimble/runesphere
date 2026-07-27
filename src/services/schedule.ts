export type Schedule = {
  getAnchor(): number;
  spawnIntervalSeconds: number;
  sphereLifetimeSeconds: number;
  searchWindowMinutes: number;
  version: number;
};

export const EstimatedSchedule ={
  "spawnIntervalSeconds": 9050,
  "sphereLifetimeSeconds": 3620,
  "searchWindowMinutes": 5,
  "version": 1,

  getAnchor: ()=>{
    const now = new Date();
    const currentDay = now.getUTCDay();
    const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1;
    const resetDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(), // Subtract 1 day cause the day is really sunday, but the reset is on monday
        10, 30, 0, 0
    ));
    resetDate.setUTCDate(resetDate.getUTCDate() - daysToSubtract);
    if (now.getTime() < resetDate.getTime()) {
        resetDate.setUTCDate(resetDate.getUTCDate() - 7);
    }
    return Math.floor(resetDate.getTime() / 1000);
    }

}
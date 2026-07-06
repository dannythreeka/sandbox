/** 補給消耗與士氣（docs/01 §4.1、docs/05 §1 PHASE 3）。 */
import { BALANCE } from "../content/constants";

export interface SupplyState {
  food: number;
  water: number;
  morale: number;
}

export interface SupplyTickResult extends SupplyState {
  starved: boolean;
}

/** 每 tick 消耗糧水；任一斷糧則士氣下降，否則士氣緩慢回升（上限 100）。 */
export function consumeSupplies(state: SupplyState, crew: number): SupplyTickResult {
  const food = Math.max(0, state.food - crew * BALANCE.FOOD_PER_CREW_PER_TICK);
  const water = Math.max(0, state.water - crew * BALANCE.WATER_PER_CREW_PER_TICK);
  const starved = food === 0 || water === 0;
  const morale = starved
    ? Math.max(0, state.morale - 5)
    : Math.min(100, state.morale + 1);
  return { food, water, morale, starved };
}

import { CreepSpawnData } from "./creep-spawn-data";

export class CreepBodyBuilder {
  static buildClaimer(): Array<BodyPartConstant> {
    return [MOVE, CLAIM];
  }

  static buildBasicWorker(energyAvailable: number): Array<BodyPartConstant> {
    const bodyArray: Array<BodyPartConstant> = [MOVE, CARRY, WORK];
    energyAvailable -= 200;
    const partCount = { WORK: 1, MOVE: 1, CARRY: 1 };
    while (energyAvailable >= 50 && bodyArray.length < 30) {
      if (partCount.MOVE <= partCount.WORK && partCount.MOVE <= partCount.CARRY) {
        partCount.MOVE += 1;
        bodyArray.unshift(MOVE);
        energyAvailable -= CreepSpawnData.getBodyPartCost(MOVE);
      } else if (partCount.WORK <= partCount.CARRY && energyAvailable >= CreepSpawnData.getBodyPartCost(WORK)) {
        bodyArray.unshift(WORK);
        partCount.WORK += 1;
        energyAvailable -= CreepSpawnData.getBodyPartCost(WORK);
      } else {
        bodyArray.unshift(CARRY);
        partCount.CARRY += 1;
        energyAvailable -= CreepSpawnData.getBodyPartCost(CARRY);
      }
    }
    return bodyArray;
  }
  static buildMiner(energyAvailable: number): Array<BodyPartConstant> {
    const bodyArray: Array<BodyPartConstant> = [MOVE, CARRY, WORK];
    energyAvailable -= 200;
    const partCount = { WORK: 1, MOVE: 1, CARRY: 1 };
    while (energyAvailable >= 50 && bodyArray.length < 30) {
      if (energyAvailable >= CreepSpawnData.getBodyPartCost(WORK)) {
        bodyArray.unshift(WORK);
        partCount.WORK += 1;
        energyAvailable -= CreepSpawnData.getBodyPartCost(WORK);
      } else {
        partCount.MOVE += 1;
        bodyArray.unshift(MOVE);
        energyAvailable -= CreepSpawnData.getBodyPartCost(MOVE);
      }
    }
    return bodyArray;
  }
  static buildTransport(energyAvailable: number): Array<BodyPartConstant> {
    const bodyArray: Array<BodyPartConstant> = [MOVE, CARRY];
    energyAvailable -= 200;
    const partCount = { MOVE: 1, CARRY: 1 };
    while (energyAvailable >= 50 && bodyArray.length < 30) {
      if (partCount.MOVE > partCount.CARRY) {
        bodyArray.unshift(CARRY);
        partCount.CARRY += 1;
        energyAvailable -= CreepSpawnData.getBodyPartCost(CARRY);
      } else {
        partCount.MOVE += 1;
        bodyArray.unshift(MOVE);
        energyAvailable -= CreepSpawnData.getBodyPartCost(MOVE);
      }
    }
    return bodyArray;
  }
  static buildMelee(energyAvailable: number): Array<BodyPartConstant> {
    const bodyArray: Array<BodyPartConstant> = [MOVE, ATTACK];
    energyAvailable -= 130;
    const partCount = { ATTACK: 1, MOVE: 1, TOUGH: 0 };
    while (energyAvailable >= 50 && bodyArray.length < 30) {
      if (partCount[MOVE] / bodyArray.length < 0.5 && energyAvailable >= CreepSpawnData.getBodyPartCost(MOVE)) {
        partCount[MOVE] += 1;
        bodyArray.unshift(MOVE);
        energyAvailable -= CreepSpawnData.getBodyPartCost(MOVE);
      } else if (energyAvailable >= CreepSpawnData.getBodyPartCost(ATTACK)) {
        partCount[ATTACK] += 1;
        bodyArray.unshift(ATTACK);
        energyAvailable -= CreepSpawnData.getBodyPartCost(ATTACK);
      } else {
        partCount[MOVE] += 1;
        bodyArray.unshift(MOVE);
        energyAvailable -= CreepSpawnData.getBodyPartCost(MOVE);
      }
    }
    return bodyArray;
  }
}

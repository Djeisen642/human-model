import Person from '../App/Person';
import Constants from '../Helpers/Constants';

export default class DeathRecord {
  readonly cause: number;
  readonly killer: Person|undefined;

  /**
   * DeathRecord Constructor
   *
   * @param cause - cause of death
   * @param [killer] - if killed by someone, then the person that murdered this person
   */
  constructor(cause: number, killer?: Person) {
    this.cause = cause;
    if (this.cause === Constants.CAUSE_OF_DEATH.MURDER) {
      this.killer = killer;
    }
  }
}
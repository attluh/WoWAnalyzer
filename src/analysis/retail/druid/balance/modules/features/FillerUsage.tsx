import { t } from '@lingui/macro';
import { formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import { ThresholdStyle, When } from 'parser/core/ParseResults';

import { cooldownAbility } from '../../constants';
import { hardcastTargetsHit } from '../../normalizers/CastLinkNormalizer';

// minimum targets Starfire must hit for it to be worth to cast in lunar eclipse/CA
export const STARFIRE_TARGETS_FOR_SOLAR = 2;

// Priority outside of CA/Inc
// On <=2 targets enter Solar Eclipse and cast Wrath
export const WRATH_TARGETS_FOR_SOLAR = 2;
// On 3+ targets enter Lunar Eclipse and cast Starfire
export const STARFIRE_TARGETS_FOR_LUNAR = 3;

// Priority inside of CA/Inc
// On <=3 targets fill with Wrath
export const WRATH_TARGETS_FOR_CA = 3;
// On 4+ targets fill with Starfire
export const STARFIRE_TARGETS_FOR_CA = 4;

const MINOR_THRESHOLD = 0;
const AVERAGE_THRESHOLD = 0.05;
const MAJOR_THRESHOLD = 0.1;

const DEBUG = false;

class FillerUsage extends Analyzer {
  totalFillerCasts: number = 0;
  badFillerCasts: number = 0;

  constructor(options: Options) {
    super(options);

    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.STARFIRE), this.onStarfire);
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.WRATH), this.onWrath);
  }

  isBadFillerEnteringEclipse(correctTargetsHit: boolean) {
    return (
      // Not in Lunar/Solar Eclipse, or CA/Inc
      !(
        this.selectedCombatant.hasBuff(SPELLS.ECLIPSE_LUNAR.id) ||
        this.selectedCombatant.hasBuff(SPELLS.ECLIPSE_SOLAR.id) ||
        this.selectedCombatant.hasBuff(cooldownAbility(this.selectedCombatant).id)
      ) &&
      // Targets
      correctTargetsHit
    );
  }

  isBadFillerInsideEclipse(correctTargetsHit: boolean) {
    return (
      // In Lunar/Solar Eclipse
      (this.selectedCombatant.hasBuff(SPELLS.ECLIPSE_LUNAR.id) ||
        this.selectedCombatant.hasBuff(SPELLS.ECLIPSE_SOLAR.id)) &&
      // Not in CA/Inc
      !this.selectedCombatant.hasBuff(cooldownAbility(this.selectedCombatant).id) &&
      // Targets
      correctTargetsHit
    );
  }

  isBadFillerInsideCooldowns(correctTargetsHit: boolean) {
    // In CA/Inc
    return (
      this.selectedCombatant.hasBuff(cooldownAbility(this.selectedCombatant).id) &&
      correctTargetsHit
    );
  }

  registerBadFillerCast(event: CastEvent, inefficientCastReason: string) {
    DEBUG &&
      console.log(
        `Bad Filler: ${event.ability.name} @ ${this.owner.formatTimestamp(event.timestamp)}`,
      );
    this.badFillerCasts += 1;
    event.meta = event.meta || {};
    event.meta.isInefficientCast = true;
    event.meta.inefficientCastReason = `This was the wrong filler for the situation! ${inefficientCastReason}`;
  }

  onStarfire(event: CastEvent) {
    this.totalFillerCasts += 1;
    const targetsHit = hardcastTargetsHit(event);

    if (this.isBadFillerInsideCooldowns(targetsHit < STARFIRE_TARGETS_FOR_CA)) {
      this.registerBadFillerCast(
        event,
        `You should use Wrath when inside CA/Inc on less than ${STARFIRE_TARGETS_FOR_CA} targets.`,
      );
    }

    if (this.isBadFillerEnteringEclipse(targetsHit >= STARFIRE_TARGETS_FOR_CA)) {
      this.registerBadFillerCast(
        event,
        `You should use Wrath when out of eclipse to enter Lunar Eclipse on ${STARFIRE_TARGETS_FOR_LUNAR} or more targets.`,
      );
    }

    if (this.isBadFillerInsideEclipse(targetsHit < STARFIRE_TARGETS_FOR_CA)) {
      this.registerBadFillerCast(
        event,
        `You should use Wrath when inside eclipse on less than ${STARFIRE_TARGETS_FOR_LUNAR} targets.`,
      );
    }
  }

  onWrath(event: CastEvent) {
    this.totalFillerCasts += 1;
    const targetsHit = hardcastTargetsHit(event);

    if (this.isBadFillerInsideCooldowns(targetsHit > WRATH_TARGETS_FOR_CA)) {
      this.registerBadFillerCast(
        event,
        `You should use Starfire when inside CA/Inc on more than ${WRATH_TARGETS_FOR_CA} targets.`,
      );
    }

    if (this.isBadFillerEnteringEclipse(targetsHit > WRATH_TARGETS_FOR_SOLAR)) {
      this.registerBadFillerCast(
        event,
        `You should use Starfire when out of eclipse to enter Solar Eclipse on ${WRATH_TARGETS_FOR_SOLAR} or less targets.`,
      );
    }

    if (this.isBadFillerInsideEclipse(targetsHit > WRATH_TARGETS_FOR_SOLAR)) {
      this.registerBadFillerCast(
        event,
        `You should use Starfire when inside eclipse on more than ${WRATH_TARGETS_FOR_SOLAR} targets.`,
      );
    }
  }

  get percentBadFillers() {
    return this.badFillerCasts / this.totalFillerCasts || 0;
  }

  get percentGoodFillers() {
    return 1 - this.percentBadFillers;
  }

  get suggestionThresholds() {
    return {
      actual: this.percentBadFillers,
      isGreaterThan: {
        minor: MINOR_THRESHOLD,
        average: AVERAGE_THRESHOLD,
        major: MAJOR_THRESHOLD,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  get goodCastSuggestionThresholds() {
    return {
      actual: this.percentGoodFillers,
      isLessThan: {
        minor: 1 - MINOR_THRESHOLD,
        average: 1 - AVERAGE_THRESHOLD,
        major: 1 - MAJOR_THRESHOLD,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  suggestions(when: When) {
    when(this.suggestionThresholds).addSuggestion((suggest, actual, recommended) =>
      suggest(
        <>
          You cast the wrong filler spell {this.badFillerCasts} times -{' '}
          {formatPercentage(actual, 1)}% of total filler casts. You should cast{' '}
          <SpellLink id={SPELLS.WRATH_MOONKIN.id} /> during and after{' '}
          <SpellLink id={SPELLS.ECLIPSE_SOLAR.id} />, and you should cast{' '}
          <SpellLink id={SPELLS.STARFIRE.id} /> during and after{' '}
          <SpellLink id={SPELLS.ECLIPSE_LUNAR.id} />.
          <br />
          <br />
          The only exceptions are during{' '}
          <SpellLink id={cooldownAbility(this.selectedCombatant).id} /> you should cast Wrath
          against single targets and Starfire against multiple targets, and when you can hit{' '}
          {STARFIRE_TARGETS_FOR_SOLAR} targets you can cast Starfire event during Solar Eclipse.
          These exception are excluded from this statistic.
        </>,
      )
        .icon(SPELLS.ECLIPSE.icon)
        .actual(
          t({
            id: 'druid.balance.suggestions.filler.efficiency',
            message: `${formatPercentage(actual, 1)}% wrong filler spell casts`,
          }),
        )
        .recommended(`none are recommended`),
    );
  }
}

export default FillerUsage;

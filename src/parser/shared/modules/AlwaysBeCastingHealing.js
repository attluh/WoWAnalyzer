import React from 'react';

import { Zerotorescue } from 'CONTRIBUTORS';
import { formatPercentage } from 'common/format';
import CoreAlwaysBeCasting from 'parser/shared/modules/AlwaysBeCasting';
import { STATISTIC_ORDER } from 'interface/others/StatisticBox';
import Statistic from 'interface/statistics/Statistic';
import Gauge from 'interface/statistics/components/Gauge';

class AlwaysBeCastingHealing extends CoreAlwaysBeCasting {
  static HEALING_ABILITIES_ON_GCD = [
    // Extend this class and override this property in your spec class to implement this module.
  ];

  healingTime = 0;
  get healingTimePercentage() {
    return this.healingTime / this.owner.fightDuration;
  }
  get nonHealingTimePercentage() {
    return 1 - this.healingTimePercentage;
  }

  _lastHealingCastFinishedTimestamp = null;

  on_globalcooldown(event) {
    if (!super.on_globalcooldown(event)) {
      return false;
    }
    if (this.countsAsHealingAbility(event)) {
      this.healingTime += event.duration;
    }
    return true;
  }
  on_endchannel(event) {
    if (!super.on_endchannel(event)) {
      return false;
    }
    if (this.countsAsHealingAbility(event)) {
      this.healingTime += event.duration;
    }
    return true;
  }
  countsAsHealingAbility(event) {
    return this.constructor.HEALING_ABILITIES_ON_GCD.includes(event.ability.guid);
  }

  showStatistic = true;
  static icons = {
    healingTime: '/img/healing.png',
    activeTime: '/img/sword.png',
    downtime: '/img/afk.png',
  };
  statistic() {
    if (!this.showStatistic) {
      return null;
    }

    const downtimePercentage = this.downtimePercentage;
    const healingTimePercentage = this.healingTimePercentage;
    // TODO: Put this in the extra box
    const nonHealCastTimePercentage = this.activeTimePercentage - healingTimePercentage;

    return (
      <Statistic
        position={STATISTIC_ORDER.CORE(10)}
        tooltip="For more details, see the timeline. Created by Zerotorescue."
      >
        <div className="pad">
          <label>Active time</label>

          <Gauge value={1 - downtimePercentage} />
        </div>
      </Statistic>

      // <StatisticBox
      //   position={STATISTIC_ORDER.CORE(10)}
      //   icon={<Icon icon="spell_mage_altertime" alt="Downtime" />}
      //   value={`${formatPercentage(downtimePercentage)} %`}
      //   label="Downtime"
      //   tooltip={`Downtime is available time not used to cast anything (including not having your GCD rolling). This can be caused by delays between casting spells, latency, cast interrupting or just simply not casting anything (e.g. due to movement/stunned).<br/>
      //   <li>You spent <b>${formatPercentage(healingTimePercentage)}%</b> of your time casting heals.</li>
      //   <li>You spent <b>${formatPercentage(nonHealCastTimePercentage)}%</b> of your time casting non-healing spells.</li>
      //   <li>You spent <b>${formatPercentage(downtimePercentage)}%</b> of your time casting nothing at all.</li>
      //   `}
      //   footer={(
      //     <div className="statistic-bar">
      //       <div
      //         className="stat-health-bg"
      //         style={{ width: `${healingTimePercentage * 100}%` }}
      //         data-tip={`You spent <b>${formatPercentage(healingTimePercentage)}%</b> of your time casting heals.`}
      //       >
      //         <img src={this.constructor.icons.healingTime} alt="Healing time" />
      //       </div>
      //       <div
      //         className="Druid-bg"
      //         style={{ width: `${nonHealCastTimePercentage * 100}%` }}
      //         data-tip={`You spent <b>${formatPercentage(nonHealCastTimePercentage)}%</b> of your time casting non-healing spells.`}
      //       >
      //         <img src={this.constructor.icons.activeTime} alt="Non-heal cast time" />
      //       </div>
      //       <div
      //         className="remainder DeathKnight-bg"
      //         data-tip={`You spent <b>${formatPercentage(downtimePercentage)}%</b> of your time casting nothing at all.`}
      //       >
      //         <img src={this.constructor.icons.downtime} alt="Downtime" />
      //       </div>
      //     </div>
      //   )}
      // />
    );
  }

  get nonHealingTimeSuggestionThresholds() {
    return {
      actual: this.nonHealingTimePercentage,
      isGreaterThan: {
        minor: 0.3,
        average: 0.4,
        major: 0.45,
      },
      style: 'percentage',
    };
  }
  // Override these suggestion thresholds for healers: it's much less important to DPS so allow for considerable slack.
  get downtimeSuggestionThresholds() {
    return {
      actual: this.downtimePercentage,
      isGreaterThan: {
        minor: 0.2,
        average: 0.35,
        major: 1,
      },
      style: 'percentage',
    };
  }
  suggestions(when) {
    when(this.nonHealingTimeSuggestionThresholds)
      .addSuggestion((suggest, actual, recommended) => {
        return suggest('Your time spent healing can be improved. Try to reduce the amount of time you\'re not healing, for example by reducing the delay between casting spells, moving during the GCD and if you have to move try to continue healing with instant spells.')
          .icon('petbattle_health-down')
          .actual(`${1 - formatPercentage(actual)}% time spent healing`)
          .recommended(`>${formatPercentage(1 - recommended)}% is recommended`);
      });
    when(this.downtimeSuggestionThresholds)
      .addSuggestion((suggest, actual, recommended) => {
        return suggest('Your active time can be improved. Try to reduce your downtime, for example by reducing the delay between casting spells and when you\'re not healing try to contribute some damage.')
          .icon('spell_mage_altertime')
          .actual(`${formatPercentage(1 - actual)}% active time`)
          .recommended(`>${formatPercentage(1 - recommended)}% is recommended`);
      });
  }
}

export default AlwaysBeCastingHealing;

import clsx from 'clsx';

type ProjectVisualProps = {
  type: string;
  title: string;
};

const rows = ['Home 92', 'Guest 88', 'Period 4', 'Clock 01:24'];
const logs = ['SIM active', 'Gateway reachable', 'TTN join accepted', 'DynamoDB write OK'];
const tests = ['Bootloader', 'Serial checksum', 'Firmware flash', 'Cloud receipt'];
const resources = ['Brick 8.4', 'Ore 7.1', 'Wheat 6.8', 'Port +1.2'];

export default function ProjectVisual({ type, title }: ProjectVisualProps) {
  return (
    <div className={clsx('project-visual', `project-visual-${type}`)} aria-label={`${title} visual preview`}>
      <div className="visual-toolbar">
        <span />
        <span />
        <span />
        <strong>{title}</strong>
      </div>

      {type === 'scoreboard' && (
        <div className="scoreboard-mock">
          <div className="scoreboard-display">
            {rows.map((row) => (
              <div key={row}>{row}</div>
            ))}
          </div>
          <div className="layout-palette">
            {['Digits', 'Logo', 'Labels', 'Indicators'].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      )}

      {type === 'mobile' && (
        <div className="phone-mock">
          <div className="phone-score">HOME 3 - 2 AWAY</div>
          <div className="phone-clock">12:00</div>
          <div className="phone-controls">
            {['Goal', 'Horn', 'Clock', 'BLE'].map((item) => (
              <button key={item} type="button">{item}</button>
            ))}
          </div>
        </div>
      )}

      {type === 'console' && (
        <div className="console-mock">
          {logs.map((log, index) => (
            <div key={log}>
              <span>0{index + 1}</span>
              <strong>{log}</strong>
            </div>
          ))}
        </div>
      )}

      {type === 'tester' && (
        <div className="tester-mock">
          {tests.map((test) => (
            <div key={test}>
              <span>{test}</span>
              <strong>PASS</strong>
            </div>
          ))}
        </div>
      )}

      {type === 'catan' && (
        <div className="catan-mock">
          <div className="hex-grid">
            {resources.map((resource) => (
              <span key={resource}>{resource}</span>
            ))}
          </div>
          <strong>Best settlement: 9.6</strong>
        </div>
      )}
    </div>
  );
}

import { useId } from "react";
import styles from "./DeviceSelect.module.css";
import { useDeviceContext } from "../../shared/device";

/** Escolhe o galinheiro em uso; com um só, mostra apenas o nome. */
export function DeviceSelect() {
  const id = useId();
  const { devices, activeId, select } = useDeviceContext();
  if (devices.length === 0) return null;
  if (devices.length === 1) {
    return <span className={styles.single}>{devices[0]?.name}</span>;
  }
  return (
    <div className={styles.wrap}>
      <label htmlFor={id} className={styles.label}>
        Galinheiro
      </label>
      <select
        id={id}
        className={styles.select}
        value={activeId ?? ""}
        onChange={(e) => select(e.target.value)}
      >
        {devices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}

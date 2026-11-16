import { Card } from "../../shared/ui";
import { TemperatureChart } from "./components/TemperatureChart";

export function ReadingsChart() {
  return (
    <Card title="Temperatura">
      <TemperatureChart points={[]} />
    </Card>
  );
}

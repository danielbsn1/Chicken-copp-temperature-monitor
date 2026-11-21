import { useNavigate } from "react-router";
import { PageHeader } from "../../shared/ui";
import { Card } from "../../shared/ui";
import { PairForm } from "./components/PairForm";
import { useDeviceContext } from "../../shared/device";
import { useClaim } from "./devices.hooks";
import type { ClaimInput } from "./devices.schemas";
import styles from "./pair.page.module.css";

/** Vincula um equipamento novo à conta que já está logada. */
export function PairPage() {
  const claim = useClaim();
  const navigate = useNavigate();
  const { select, devices } = useDeviceContext();

  function submit(input: ClaimInput) {
    claim.mutate(input, {
      onSuccess: (claimed) => {
        select(claimed.deviceId);
        void navigate("/");
      },
    });
  }

  return (
    <main>
      <PageHeader title="Adicionar equipamento" />
      <div className={styles.wrap}>
        <Card title={devices.length === 0 ? "Vamos começar" : "Novo equipamento"}>
          <PairForm
            pending={claim.isPending}
            error={claim.error}
            onSubmit={(input) => submit(input as ClaimInput)}
          />
        </Card>
      </div>
    </main>
  );
}

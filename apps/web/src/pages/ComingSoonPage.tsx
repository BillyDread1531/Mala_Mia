import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

interface ComingSoonPageProps {
  title: string;
}

export function ComingSoonPage({ title }: ComingSoonPageProps) {
  return (
    <Card>
      <EmptyState
        title={`${title} estará disponible pronto`}
        description="Estamos construyendo esta sección de MALA MÍA. Por ahora puedes seguir usando el resto de la aplicación."
      />
    </Card>
  );
}

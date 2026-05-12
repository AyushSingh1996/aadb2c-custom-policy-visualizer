import { BookMarked } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState.js';

function titleFromStubId(stubId: string | undefined): string {
  switch (stubId) {
    case 'history':
      return 'History';
    case 'settings':
      return 'Settings';
    case 'documentation':
      return 'Documentation';
    default:
      return 'Placeholder';
  }
}

export function PlaceholderScreen(): JSX.Element {
  const { stubId } = useParams<{ stubId: string }>();
  const title = titleFromStubId(stubId);

  return (
    <section className="screen-shell">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">{title}</h1>
          <p className="page-header__subtitle">This section is a visual placeholder in the MVP.</p>
        </div>
      </header>

      <EmptyState
        icon={<BookMarked size={26} />}
        title={`${title} is not implemented in this release`}
        subtitle="The sidebar target is present for layout fidelity, but no functional behavior is attached yet."
      />
    </section>
  );
}

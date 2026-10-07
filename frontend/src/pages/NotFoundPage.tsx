import { Link } from 'react-router';

export function NotFoundPage(): React.JSX.Element {
  return (
    <section>
      <h1 style={{ fontSize: 20, margin: 0 }}>Page not found</h1>
      <p>
        <Link to="/">Back to the overview</Link>
      </p>
    </section>
  );
}

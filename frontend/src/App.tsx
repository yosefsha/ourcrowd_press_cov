import { createBrowserRouter, RouterProvider } from 'react-router';

import { routes } from './routes.tsx';

const router = createBrowserRouter(routes);

export default function App(): React.JSX.Element {
  return <RouterProvider router={router} />;
}

import '../styles/globals.css'
import { ProctoringProvider } from '../context/ProctoringProvider';

function MyApp({ Component, pageProps }) {
  return (
    <ProctoringProvider>
      <Component {...pageProps} />
    </ProctoringProvider>
  );
}

export default MyApp

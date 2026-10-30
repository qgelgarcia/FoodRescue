import React from 'react';
import { createRoot } from 'react-dom/client';
import { IonApp, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import App from './App';
import NativeAuthCallback from './components/auth/NativeAuthCallback';
import './styles.css';

setupIonicReact();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IonApp>
      <IonReactRouter>
        <NativeAuthCallback />
        <App />
      </IonReactRouter>
    </IonApp>
  </React.StrictMode>
);

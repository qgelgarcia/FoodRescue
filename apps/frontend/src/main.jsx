import React from 'react';
import { createRoot } from 'react-dom/client';
import { IonApp, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import App from './App';
import './styles.css';

setupIonicReact();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IonApp>
      <IonReactRouter>
        <App />
      </IonReactRouter>
    </IonApp>
  </React.StrictMode>
);

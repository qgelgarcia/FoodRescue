import React from 'react';
import { IonContent, IonPage } from '@ionic/react';

export default function PageShell({ children, className = '' }) {
  return (
    <IonPage className={className}>
      <IonContent fullscreen className="foodrescue-content">
        {children}
      </IonContent>
    </IonPage>
  );
}

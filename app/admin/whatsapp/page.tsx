// WhatsApp admin main page (solo admins)

import WhatsAppAdminPanel from '../../../components/whatsapp/WhatsAppAdminPanel';
import { ColaboradoresProvider } from '../../../components/ColaboradoresProvider';

export default function WhatsAppPage() {
  return (
    <ColaboradoresProvider>
      <WhatsAppAdminPanel />
    </ColaboradoresProvider>
  );
}

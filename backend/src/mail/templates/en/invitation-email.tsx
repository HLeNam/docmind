import { Text, Button } from '@react-email/components';
import { Layout } from '../components/layout.js';

export interface InvitationEmailProps {
  tenantName: string;
  inviterEmail: string;
  acceptUrl: string;
}

// Subject cùng file với component — sửa 1 loại mail chỉ cần sửa đúng 1 file, không rải rác.
export function subject(props: InvitationEmailProps): string {
  return `${props.inviterEmail} invited you to join ${props.tenantName} on DocMind`;
}

export default function InvitationEmail({
  tenantName,
  inviterEmail,
  acceptUrl,
}: InvitationEmailProps) {
  return (
    <Layout>
      <Text>Hi,</Text>
      <Text>
        <strong>{inviterEmail}</strong> has invited you to join the{' '}
        <strong>{tenantName}</strong> workspace on DocMind.
      </Text>
      <Button
        href={acceptUrl}
        style={{
          background: '#111827',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: 6,
          fontWeight: 600,
        }}
      >
        Accept invitation
      </Button>
      <Text style={{ color: '#6b7280', fontSize: 13 }}>
        This invitation expires in 7 days. If you weren't expecting this, you
        can safely ignore this email.
      </Text>
    </Layout>
  );
}

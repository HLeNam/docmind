import { Html, Body, Container, Section, Text } from '@react-email/components';
import type { ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <Html>
      <Body
        style={{
          backgroundColor: '#f4f4f5',
          fontFamily: 'sans-serif',
          margin: 0,
          padding: '32px 0',
        }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 8,
            overflow: 'hidden',
            maxWidth: 480,
          }}
        >
          <Section style={{ padding: '24px 32px', backgroundColor: '#111827' }}>
            <Text
              style={{
                color: '#ffffff',
                fontSize: 18,
                fontWeight: 600,
                margin: 0,
              }}
            >
              DocMind
            </Text>
          </Section>
          <Section
            style={{
              padding: 32,
              color: '#111827',
              fontSize: 15,
              lineHeight: 1.6,
            }}
          >
            {children}
          </Section>
          <Section style={{ padding: '20px 32px', backgroundColor: '#f9fafb' }}>
            <Text style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>
              © {new Date().getFullYear()} DocMind. This is an automated
              message.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

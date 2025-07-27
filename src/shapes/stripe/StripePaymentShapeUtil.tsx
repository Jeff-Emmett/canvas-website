import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  T,
  TLBaseShape,
} from 'tldraw';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

// Declare global variable from vite config
declare const __STRIPE_PUBLISHABLE_KEY__: string;

// Define the shape type inline to avoid import conflicts
export type StripePaymentShape = TLBaseShape<
  'stripe-payment',
  {
    w: number;
    h: number;
  }
>;

// Define subscription plans
const SUBSCRIPTION_PLANS = [
  {
    id: 'price_1RdDMgKFe1dC1xn7p319KRDU', // Basic Support Stream
    name: 'Basic Support Stream',
    price: 500, // $5.00 CAD
    interval: 'month',
    description: 'I like what you\'re doing',
    features: ['Yay support']
  },
  {
    id: 'price_1RdDMwKFe1dC1xn7kDSgE95J', // Mid-range support stream
    name: 'Mid-range support stream',
    price: 2500, // $25.00 CAD
    interval: 'month',
    description: 'Wait this stuff could actually be helpful',
    features: ['Even Yayer']
  },
  {
    id: 'price_1RdDNAKFe1dC1xn7x2n0FUI5', // Comrades & Collaborators
    name: 'Comrades & Collaborators',
    price: 5000, // $50.00 CAD
    interval: 'month',
    description: 'We are the ones we\'ve been waiting for',
    features: ['The yayest of them all']
  }
];

// Stripe Payment Form Component
function StripePaymentForm({ clientSecret }: { clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !mountedRef.current) return;

    setProcessing(true);
    setError(null);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
      });

      if (error && mountedRef.current) {
        setError(error.message || 'Payment failed');
      }
    } catch (err) {
      if (mountedRef.current) {
        setError('An unexpected error occurred');
      }
    } finally {
      if (mountedRef.current) {
        setProcessing(false);
      }
    }
  };

  if (typeof __STRIPE_PUBLISHABLE_KEY__ === 'undefined' || !__STRIPE_PUBLISHABLE_KEY__) {
    return <div style={{ color: '#dc3545', textAlign: 'center', padding: '20px' }}>
      <div>Stripe configuration error. Please check your setup.</div>
    </div>;
  }

  const stripePromise = loadStripe(__STRIPE_PUBLISHABLE_KEY__);

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'flat',
          variables: {
            colorPrimary: '#0066cc',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            fontSizeBase: '16px',
            spacingUnit: '8px',
            borderRadius: '8px',
          },
        },
      }}
    >
      <form onSubmit={handleSubmit} style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ flexShrink: 0 }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: '700', color: '#1a1a1a', textAlign: 'center' }}>
            Complete Your Subscription
          </h2>
          <p style={{ margin: 0, color: '#666', fontSize: '14px', textAlign: 'center', lineHeight: '1.4' }}>
            Enter your payment details to start your subscription
          </p>
        </div>

        <div style={{ flex: 1, marginBottom: '16px', minHeight: '180px' }}>
          <PaymentElement />
        </div>

        {error && (
          <div style={{ 
            color: '#dc3545', marginBottom: '16px', fontSize: '14px',
            padding: '12px', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb',
            borderRadius: '8px', textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!stripe || processing}
          style={{
            width: '100%', padding: '14px',
            backgroundColor: processing ? '#ccc' : '#0066cc',
            color: 'white', border: 'none', borderRadius: '8px',
            fontSize: '16px', fontWeight: '600',
            cursor: processing ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s ease', minHeight: '44px',
          }}
        >
          {processing ? 'Processing...' : 'Start Subscription'}
        </button>
      </form>
    </Elements>
  );
}

// Stripe Payment Popup Component
export function StripePaymentPopup({ onClose }: { onClose: () => void }) {
  const [selectedPlanId, setSelectedPlanId] = useState('price_1RdDMgKFe1dC1xn7p319KRDU');
  const [customerEmail, setCustomerEmail] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const initializeSubscription = useCallback(async () => {
    // Only proceed if we have a valid email and aren't already loading
    if (isLoading || clientSecret || !customerEmail.trim() || !mountedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      const selectedPlan = SUBSCRIPTION_PLANS.find(plan => plan.id === selectedPlanId) || SUBSCRIPTION_PLANS[0];

      const response = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: selectedPlan.id,
          customerEmail: customerEmail.trim(),
          metadata: { planId: selectedPlan.id },
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!mountedRef.current) return;

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as { client_secret: string; payment_intent_id?: string; customer_id?: string; price_id?: string };
      if (!data.client_secret) {
        throw new Error('No client secret received from server');
      }

      if (mountedRef.current) {
        setClientSecret(data.client_secret);
      }
    } catch (err) {
      if (mountedRef.current) {
        console.error('Stripe: Subscription initialization error:', err);
        setError('Failed to initialize subscription. Please try again.');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [selectedPlanId, customerEmail, isLoading, clientSecret]);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        width: '600px',
        height: '700px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px', right: '16px',
            width: '32px', height: '32px',
            border: 'none',
            backgroundColor: '#f8f9fa',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            zIndex: 1,
          }}
        >
          ×
        </button>

        {!clientSecret ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: '700', color: '#1a1a1a', textAlign: 'center' }}>
              Choose Your Plan
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', flex: 1, overflow: 'auto' }}>
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  style={{
                    padding: '16px',
                    border: `2px solid ${selectedPlanId === plan.id ? '#0066cc' : '#e0e0e0'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedPlanId === plan.id ? '#f0f8ff' : 'transparent',
                    transition: 'all 0.2s ease',
                    minHeight: '100px',
                  }}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>
                    {plan.name}
                  </h3>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#0066cc', marginBottom: '6px' }}>
                    ${(plan.price / 100).toFixed(2)}/{plan.interval}
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666', lineHeight: '1.4' }}>
                    {plan.description}
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', lineHeight: '1.4' }}>
                    {plan.features.map((feature, index) => (
                      <li key={index} style={{ marginBottom: '2px' }}>{feature}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px', color: '#1a1a1a' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Enter your email"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                onClick={initializeSubscription}
                disabled={isLoading || !customerEmail.trim()}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: (isLoading || !customerEmail.trim()) ? '#ccc' : '#0066cc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: (isLoading || !customerEmail.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s ease',
                  minHeight: '44px',
                }}
              >
                {isLoading ? 'Initializing...' : !customerEmail.trim() ? 'Enter email to continue' : `Subscribe to ${SUBSCRIPTION_PLANS.find(plan => plan.id === selectedPlanId)?.name} - $${(SUBSCRIPTION_PLANS.find(plan => plan.id === selectedPlanId)?.price || 0) / 100}/month`}
              </button>
            </div>
          </div>
        ) : (
          <StripePaymentForm clientSecret={clientSecret} />
        )}

        {error && (
          <div style={{ 
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            backgroundColor: '#ffffff', padding: '32px', borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)', textAlign: 'center', zIndex: 2,
          }}>
            <div style={{ fontSize: '40px', color: '#dc3545', marginBottom: '12px' }}>⚠️</div>
            <div style={{ color: '#dc3545', fontSize: '16px', fontWeight: '600', marginBottom: '20px' }}>
              {error}
            </div>
            <button 
              onClick={() => { setError(null); setClientSecret(null); initializeSubscription(); }} 
              style={{ 
                padding: '10px 20px', backgroundColor: '#0066cc', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                fontSize: '14px', fontWeight: '600', minHeight: '40px', minWidth: '100px'
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Main shape utility class
export class StripePaymentShapeUtil extends BaseBoxShapeUtil<StripePaymentShape> {
  static type = 'stripe-payment' as const;

  getDefaultProps(): StripePaymentShape['props'] {
    return {
      w: 400,
      h: 200,
    };
  }

  override canEdit() {
    return true;
  }

  override canResize() {
    return false;
  }

  override onResize(shape: StripePaymentShape) {
    return shape;
  }

  component(shape: StripePaymentShape) {
    const [showPopup, setShowPopup] = useState(false);

    return (
      <HTMLContainer>
        <div
          style={{
            width: shape.props.w,
            height: shape.props.h,
            padding: '20px',
            backgroundColor: '#ffffff',
            border: '2px solid #e0e0e0',
            borderRadius: '12px',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px', color: '#0066cc' }}>💳</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600', color: '#1a1a1a', textAlign: 'center' }}>
            Stripe Payment
          </h3>
          <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666', textAlign: 'center', lineHeight: '1.4' }}>
            Click the button below to start your subscription
          </p>
          <button
            onClick={() => setShowPopup(true)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 4px 8px rgba(0, 102, 204, 0.2)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0052a3';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#0066cc';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Subscribe with Credit Card
          </button>
        </div>
        {showPopup && <StripePaymentPopup onClose={() => setShowPopup(false)} />}
      </HTMLContainer>
    );
  }

  indicator(shape: StripePaymentShape) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={8}
        ry={8}
        fill="none"
        stroke="#0066cc"
        strokeWidth={2}
      />
    );
  }
}
# zkGPS Protocol Specification

## Overview

zkGPS is a privacy-preserving location sharing protocol that enables users to prove location claims without revealing exact coordinates. It combines geohash-based commitments with zero-knowledge proofs to enable:

- **Proximity proofs**: "I am within X meters of location Y"
- **Region membership**: "I am inside region R"
- **Temporal proofs**: "I was at location L between times T1 and T2"
- **Group rendezvous**: "N people are all within X meters of each other"

## Design Goals

1. **Privacy by default**: No location data leaves the device unencrypted
2. **Configurable precision**: Users control granularity per trust circle
3. **Verifiable claims**: Recipients can verify proofs without learning coordinates
4. **Efficient**: Proofs must be fast enough for real-time use (<100ms)
5. **Offline-capable**: Core operations work without network

## Core Concepts

### Geohash Commitments

We use geohash encoding to create hierarchical location commitments:

```
Precision Levels:
┌─────────┬────────────────┬─────────────────────┐
│ Level   │ Cell Size      │ Use Case            │
├─────────┼────────────────┼─────────────────────┤
│ 1       │ ~5000 km       │ Continent           │
│ 2       │ ~1250 km       │ Large country       │
│ 3       │ ~156 km        │ State/region        │
│ 4       │ ~39 km         │ Metro area          │
│ 5       │ ~5 km          │ City district       │
│ 6       │ ~1.2 km        │ Neighborhood        │
│ 7       │ ~153 m         │ Block               │
│ 8       │ ~38 m          │ Building            │
│ 9       │ ~5 m           │ Room                │
│ 10      │ ~1.2 m         │ Exact position      │
└─────────┴────────────────┴─────────────────────┘
```

A commitment at level N reveals only the geohash prefix of length N, hiding all finer detail.

### Commitment Scheme

```
Commit(lat, lng, precision, salt) → C

Where:
  geohash = encode(lat, lng, precision)
  C = Hash(geohash || salt)
```

The salt prevents rainbow table attacks. The precision parameter controls how much location is revealed.

### Trust Circles

Users define trust circles with associated precision levels:

```typescript
interface TrustCircle {
  id: string;
  name: string;
  members: string[];           // User IDs or public keys
  precision: GeohashPrecision; // 1-10
  updateInterval: number;      // How often to broadcast (ms)
  requireMutual: boolean;      // Both parties must be in each other's circle
}

// Example configuration
const trustCircles = [
  { name: 'Partner',    precision: 10, members: ['alice'] },      // ~1m
  { name: 'Family',     precision: 8,  members: ['mom', 'dad'] }, // ~38m
  { name: 'Friends',    precision: 6,  members: [...] },          // ~1.2km
  { name: 'Network',    precision: 4,  members: ['*'] },          // ~39km
];
```

## Proof Types

### 1. Proximity Proof

Prove: "I am within distance D of point P"

```
ProveProximity(myLocation, targetPoint, maxDistance, salt) → Proof

Verifier learns: Boolean (within distance or not)
Verifier does NOT learn: Exact location, direction, actual distance
```

**Protocol**:
1. Prover computes geohash cells that intersect the circle of radius D around P
2. Prover commits to their geohash at appropriate precision
3. Prover generates ZK proof that their commitment falls within valid cells
4. Verifier checks proof without learning which specific cell

### 2. Region Membership Proof

Prove: "I am inside polygon R"

```
ProveRegionMembership(myLocation, regionPolygon, salt) → Proof

Verifier learns: Boolean (inside region or not)
Verifier does NOT learn: Where inside the region
```

**Protocol**:
1. Region is decomposed into geohash cells at chosen precision
2. Prover commits to their location
3. Prover generates ZK proof that commitment matches one of the region's cells
4. Verifier checks proof

### 3. Temporal Location Proof

Prove: "I was at location L between T1 and T2"

```
ProveTemporalPresence(locationHistory, targetRegion, timeRange, salt) → Proof

Verifier learns: Boolean (was present during time range)
Verifier does NOT learn: Exact times, trajectory, duration
```

**Protocol**:
1. Prover maintains signed, timestamped location commitments
2. Prover selects commitments within time range
3. Prover generates proof that at least one commitment falls within region
4. Verifier checks signature validity and proof

### 4. Group Proximity Proof (N-party)

Prove: "All N participants are within distance D of each other"

```
ProveGroupProximity(participants[], maxDistance) → Proof

All participants learn: Boolean (group is proximate)
No participant learns: Any other participant's location
```

**Protocol** (simplified):
1. Each participant commits to their geohash
2. Commitments are submitted to a coordinator (or MPC)
3. ZK proof computed that all commitments fall within compatible cells
4. Result broadcast to all participants

## Cryptographic Primitives

### Hash Function
- **Primary**: SHA-256 (widely available, fast)
- **Alternative**: Poseidon (ZK-friendly, for SNARKs)

### Commitment Scheme
- **Pedersen commitments** for hiding + binding properties
- `C = g^m * h^r` where m = geohash numeric encoding, r = randomness

### Zero-Knowledge Proofs

For MVP, we use a simplified approach that doesn't require heavy ZK machinery:

**Geohash Prefix Reveal**:
- Reveal only the N-character prefix of geohash
- Verifier confirms prefix matches claimed region
- No ZK circuit required, just truncation

For stronger privacy (future):
- **Bulletproofs**: Range proofs for coordinate bounds
- **Groth16/PLONK**: General circuits for complex predicates

## Wire Protocol

### Location Broadcast Message

```typescript
interface LocationBroadcast {
  // Header
  version: 1;
  type: 'location_broadcast';
  timestamp: number;

  // Sender
  senderId: string;
  senderPublicKey: string;

  // Location commitment (encrypted per trust circle)
  commitments: {
    trustCircleId: string;
    encryptedCommitment: string;  // Encrypted with circle's shared key
    precision: number;
  }[];

  // Signature over entire message
  signature: string;
}
```

### Proximity Query

```typescript
interface ProximityQuery {
  version: 1;
  type: 'proximity_query';

  queryId: string;
  queryer: string;

  // What we're asking
  targetUserId: string;
  maxDistance: number;  // meters

  // Our commitment (so target can also verify us)
  ourCommitment: string;
  ourPrecision: number;
}

interface ProximityResponse {
  version: 1;
  type: 'proximity_response';

  queryId: string;
  responder: string;

  // Result
  isProximate: boolean;
  proof?: string;  // Optional ZK proof

  signature: string;
}
```

## Security Considerations

### Threat Model

**Adversary capabilities**:
- Can observe all network traffic
- Can compromise some participants
- Cannot break cryptographic primitives

**Protected against**:
- Passive eavesdropping (all data encrypted)
- Location tracking over time (salts rotate)
- Correlation attacks (precision limits information)

**NOT protected against** (by design):
- Compromised trusted contacts (they receive your chosen precision)
- Physical surveillance
- Device compromise

### Precision Attacks

An adversary with multiple queries could triangulate location:
- **Mitigation**: Rate limiting on queries
- **Mitigation**: Minimum precision floor per trust level
- **Mitigation**: Query logging for user review

### Replay Attacks

Old location proofs could be replayed:
- **Mitigation**: Timestamps in commitments
- **Mitigation**: Nonces in queries
- **Mitigation**: Short expiration windows

## Implementation Phases

### Phase 1: Geohash Commitments (MVP)
- Implement geohash encoding/decoding
- Simple commitment scheme (Hash + salt)
- Trust circle configuration
- Precision-based sharing

### Phase 2: Proximity Proofs
- Cell intersection calculation
- Simple "prefix match" proofs
- Query/response protocol

### Phase 3: Advanced Proofs
- Region membership with polygon decomposition
- Temporal proofs with signed history
- Integration with canvas presence

### Phase 4: Group Protocols
- N-party proximity (requires coordinator or MPC)
- Anonymous presence in regions
- Aggregate statistics without individual data

## References

- [Geohash specification](https://en.wikipedia.org/wiki/Geohash)
- [Pedersen commitments](https://crypto.stackexchange.com/questions/64437/what-is-a-pedersen-commitment)
- [Bulletproofs paper](https://eprint.iacr.org/2017/1066.pdf)
- [Private proximity testing](https://eprint.iacr.org/2019/961.pdf)

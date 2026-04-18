'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared';
import { ProfileEditForm } from './profile-edit-form';
import type { Person, GuestDetails, PersonRelationship, Booking } from '@/types';
import type { TranslationKeys } from '@/i18n/en';
import { Pencil } from 'lucide-react';

interface MyProfileViewProps {
  person: Person;
  guestDetails: GuestDetails | null;
  relationships: Array<PersonRelationship & { related_person_name: string }>;
  bookings: Booking[];
  roles: Array<{ name: string; slug: string; accessLevel: number }>;
  dict: TranslationKeys;
}

export function MyProfileView({
  person,
  guestDetails,
  relationships,
  bookings,
  roles,
  dict,
}: MyProfileViewProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const d = dict.profile;
  const today = new Date().toISOString().split('T')[0];

  // Categorize bookings
  const currentStay = bookings.find(
    (b) => b.check_in <= today && b.check_out >= today && b.status !== 'cancelled',
  );
  const upcomingStays = bookings.filter(
    (b) => b.check_in > today && b.status !== 'cancelled',
  );
  const pastStays = bookings.filter(
    (b) => b.check_out < today || b.status === 'checked_out',
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={d.title}
        actions={
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            {d.editProfile}
          </Button>
        }
      />

      {/* ==================== TOP: Essential Info ==================== */}
      <Card>
        <CardHeader>
          <CardTitle>{d.personalInfo}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={dict.people.name} value={person.full_name} d={d} />
            <Field label={dict.people.email} value={person.email} d={d} />
            <Field label={dict.people.phone} value={person.phone} d={d} />
            <Field label={d.dateOfBirth} value={person.date_of_birth} d={d} />
            <Field label={d.gender} value={person.gender} d={d} />
            <Field label={d.pronouns} value={person.pronouns} d={d} />
            <Field label={d.country} value={person.country} d={d} />
            <Field label={d.nationality} value={person.nationality} d={d} />
            <Field label={d.whatsapp} value={person.whatsapp_number} d={d} />
            <Field label={d.communicationPref} value={person.communication_preference} d={d} />
          </div>
        </CardContent>
      </Card>

      {/* ==================== ROLES ==================== */}
      {roles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <Badge key={role.slug} variant="outline" className="text-sm capitalize">
                  {role.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================== CURRENT STATUS ==================== */}
      <Card>
        <CardHeader>
          <CardTitle>{d.currentStatus}</CardTitle>
        </CardHeader>
        <CardContent>
          {currentStay ? (
            <div className="flex items-center gap-3">
              <Badge className="bg-status-success text-status-success">{d.currentlyHere}</Badge>
              <span className="text-sm">
                {currentStay.check_in} — {currentStay.check_out}
              </span>
            </div>
          ) : upcomingStays.length > 0 ? (
            <div className="flex items-center gap-3">
              <Badge className="bg-status-info text-status-info">{d.arriving}</Badge>
              <span className="text-sm">{upcomingStays[0].check_in}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{d.notScheduled}</p>
          )}
        </CardContent>
      </Card>

      {/* ==================== MIDDLE: Filled secondary fields ==================== */}
      {guestDetails && hasAnyHealthField(guestDetails) && (
        <Card>
          <CardHeader>
            <CardTitle>{d.healthWellness}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <FilledField label={d.dietary} value={guestDetails.dietary_restrictions} />
              <FilledField label={d.allergies} value={guestDetails.allergies} />
              <FilledField label={d.medicalConditions} value={guestDetails.medical_conditions} />
              <FilledField label={d.medications} value={guestDetails.medications} />
              <FilledField label={d.injuriesLimitations} value={guestDetails.injuries_limitations} />
              <FilledField label={d.accessibility} value={guestDetails.accessibility_needs} />
              <FilledField label={d.fitnessLevel} value={guestDetails.fitness_level} />
              <FilledField label={d.yogaExperience} value={guestDetails.yoga_experience} />
              {guestDetails.is_pregnant && (
                <div className="text-sm">
                  <span className="text-muted-foreground">{d.pregnant}</span>
                  <span className="ml-2 font-medium text-warning">Yes</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {guestDetails && hasAnyPreferenceField(guestDetails) && (
        <Card>
          <CardHeader>
            <CardTitle>{d.retreatPreferences}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <FilledField label={d.roomPreference} value={guestDetails.room_preference} />
              <FilledField label={d.howHeard} value={guestDetails.how_heard_about_us} />
              {guestDetails.retreat_interests && guestDetails.retreat_interests.length > 0 && (
                <div className="text-sm sm:col-span-2">
                  <p className="text-muted-foreground">{d.retreatInterests}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {guestDetails.retreat_interests.map((interest) => (
                      <Badge key={interest} variant="outline" className="text-xs">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {guestDetails && hasAnyEmergencyField(guestDetails) && (
        <Card>
          <CardHeader>
            <CardTitle>{d.emergencyContact}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <FilledField label={d.ecName} value={guestDetails.emergency_contact_name} />
              <FilledField label={d.ecPhone} value={guestDetails.emergency_contact_phone} />
              <FilledField label={d.ecEmail} value={guestDetails.emergency_contact_email} />
              <FilledField label={d.ecRelationship} value={guestDetails.emergency_contact_relationship} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================== Relationships ==================== */}
      {relationships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{d.relationships}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {relationships.map((rel) => (
                <li key={rel.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{rel.related_person_name}</span>
                  <Badge variant="outline" className="text-xs">{rel.relationship_type}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ==================== Legal & Consent ==================== */}
      {guestDetails && (
        <Card>
          <CardHeader>
            <CardTitle>{d.legalConsent}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="text-sm">
                <p className="text-muted-foreground">{d.waiverSigned}</p>
                <p className="mt-1 font-medium">
                  {guestDetails.waiver_signed ? (
                    <span className="text-status-success">{d.signed}</span>
                  ) : (
                    <span className="text-status-destructive">{d.notSigned}</span>
                  )}
                  {guestDetails.waiver_signed_at && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      {guestDetails.waiver_signed_at.split('T')[0]}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground">{d.photoRelease}</p>
                <p className="mt-1 font-medium">
                  {guestDetails.photo_release ? (
                    <span className="text-status-success">{d.granted}</span>
                  ) : (
                    <span className="text-muted-foreground">{d.notGranted}</span>
                  )}
                </p>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground">{d.termsAccepted}</p>
                <p className="mt-1 font-medium">
                  {guestDetails.terms_accepted ? (
                    <span className="text-status-success">{d.signed}</span>
                  ) : (
                    <span className="text-status-destructive">{d.notSigned}</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================== Stay History ==================== */}
      <Card>
        <CardHeader>
          <CardTitle>{d.stayHistory} ({pastStays.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pastStays.length === 0 ? (
            <p className="text-sm text-muted-foreground">{d.noStays}</p>
          ) : (
            <ul className="space-y-2">
              {pastStays.map((b) => (
                <li key={b.id} className="flex items-center justify-between text-sm">
                  <span>{b.check_in} — {b.check_out}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono text-xs">{b.reference_code}</span>
                    <Badge variant="outline" className="text-xs">
                      {dict.bookings[`status_${b.status}` as keyof typeof dict.bookings] as string ?? b.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ==================== BOTTOM: Empty fields ==================== */}
      {guestDetails && hasEmptyFields(person, guestDetails) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground">{d.incomplete}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <EmptyField label={d.city} value={person.city} />
              <EmptyField label={d.address} value={person.address_line} />
              <EmptyField label={d.passport} value={person.passport_number} />
              <EmptyField label={d.instagram} value={person.instagram_handle} />
              {!guestDetails.dietary_restrictions && <EmptyField label={d.dietary} value={null} />}
              {!guestDetails.allergies && <EmptyField label={d.allergies} value={null} />}
              {!guestDetails.medical_conditions && <EmptyField label={d.medicalConditions} value={null} />}
              {!guestDetails.emergency_contact_name && <EmptyField label={d.emergencyContact} value={null} />}
              {!guestDetails.fitness_level && <EmptyField label={d.fitnessLevel} value={null} />}
              {!guestDetails.yoga_experience && <EmptyField label={d.yogaExperience} value={null} />}
              {!guestDetails.room_preference && <EmptyField label={d.roomPreference} value={null} />}
              {!guestDetails.how_heard_about_us && <EmptyField label={d.howHeard} value={null} />}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{d.editProfile}</DialogTitle>
          </DialogHeader>
          <ProfileEditForm
            person={person}
            dict={dict}
            onSaved={() => { setEditOpen(false); router.refresh(); }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Helper components
// ============================================================

function Field({
  label,
  value,
  d,
}: {
  label: string;
  value: string | null | undefined;
  d: { notProvided: string };
}) {
  return (
    <div className="text-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">
        {value || <span className="text-muted-foreground/50">{d.notProvided}</span>}
      </p>
    </div>
  );
}

/** Only renders if value exists */
function FilledField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="text-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

/** Shows as empty/placeholder */
function EmptyField({ label, value }: { label: string; value: string | null | undefined }) {
  if (value) return null;
  return (
    <div className="text-sm rounded-md border border-dashed border-border/50 px-3 py-2">
      <span className="text-muted-foreground/60">{label}</span>
    </div>
  );
}

// ============================================================
// Section visibility helpers
// ============================================================

function hasAnyHealthField(g: GuestDetails): boolean {
  return !!(
    g.dietary_restrictions || g.allergies || g.medical_conditions ||
    g.medications || g.injuries_limitations || g.accessibility_needs ||
    g.fitness_level || g.yoga_experience || g.is_pregnant
  );
}

function hasAnyPreferenceField(g: GuestDetails): boolean {
  return !!(
    g.room_preference || g.how_heard_about_us ||
    (g.retreat_interests && g.retreat_interests.length > 0)
  );
}

function hasAnyEmergencyField(g: GuestDetails): boolean {
  return !!(
    g.emergency_contact_name || g.emergency_contact_phone ||
    g.emergency_contact_email || g.emergency_contact_relationship
  );
}

function hasEmptyFields(p: Person, g: GuestDetails): boolean {
  return !(
    p.city && p.address_line && p.passport_number && p.instagram_handle &&
    g.dietary_restrictions && g.allergies && g.medical_conditions &&
    g.emergency_contact_name && g.fitness_level && g.yoga_experience &&
    g.room_preference && g.how_heard_about_us
  );
}

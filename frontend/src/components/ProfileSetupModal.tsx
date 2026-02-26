import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hammer, User, Loader2 } from 'lucide-react';
import { useSaveCallerUserProfile } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import type { UserProfile } from '../backend';

interface ProfileSetupModalProps {
  open: boolean;
  onComplete: () => void;
}

export default function ProfileSetupModal({ open, onComplete }: ProfileSetupModalProps) {
  const { identity } = useInternetIdentity();
  const saveProfile = useSaveCallerUserProfile();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isAuthenticated = !!identity && !identity.getPrincipal().isAnonymous();

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    else if (name.trim().length > 100) newErrors.name = 'Name must be 100 characters or less';
    if (!username.trim()) newErrors.username = 'Username is required';
    else if (username.trim().length > 50) newErrors.username = 'Username must be 50 characters or less';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (email.trim().length > 100) newErrors.email = 'Email must be 100 characters or less';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const profile: UserProfile = {
      name: name.trim(),
      username: username.trim(),
      email: email.trim(),
      linkedPrincipals: identity ? [identity.getPrincipal()] : [],
    };

    try {
      await saveProfile.mutateAsync(profile);
      onComplete();
    } catch {
      // Error handled by mutation
    }
  };

  if (!isAuthenticated) {
    return (
      <Dialog open={open}>
        <DialogContent
          className="sm:max-w-md"
          style={{
            background: 'oklch(0.15 0.012 28)',
            border: '1px solid oklch(0.28 0.025 38)',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'oklch(0.88 0.02 60)' }}>Authentication Required</DialogTitle>
            <DialogDescription style={{ color: 'oklch(0.55 0.03 50)' }}>
              Please connect your identity to set up your profile.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        style={{
          background: 'oklch(0.15 0.012 28)',
          border: '1px solid oklch(0.28 0.025 38)',
          boxShadow: '0 0 40px oklch(0.72 0.20 42 / 0.15)',
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-forge flex items-center justify-center"
              style={{ background: 'oklch(0.72 0.20 42 / 0.15)', border: '1px solid oklch(0.72 0.20 42 / 0.4)' }}
            >
              <Hammer className="w-5 h-5" style={{ color: 'oklch(0.72 0.20 42)' }} />
            </div>
            <div>
              <DialogTitle
                className="font-display text-xl font-bold tracking-wide"
                style={{ color: 'oklch(0.88 0.02 60)' }}
              >
                Welcome to the Forge
              </DialogTitle>
              <DialogDescription style={{ color: 'oklch(0.55 0.03 50)' }}>
                Set up your forger profile to get started
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="name"
              className="text-xs font-mono font-bold tracking-widest uppercase"
              style={{ color: 'oklch(0.72 0.20 42)' }}
            >
              Display Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your forge name"
              maxLength={100}
              className="forge-input"
              style={{
                background: 'oklch(0.14 0.012 28)',
                border: errors.name ? '1px solid oklch(0.55 0.22 25)' : '1px solid oklch(0.28 0.025 38)',
                color: 'oklch(0.88 0.02 60)',
              }}
            />
            <div className="flex justify-between">
              {errors.name && <p className="text-xs" style={{ color: 'oklch(0.65 0.22 25)' }}>{errors.name}</p>}
              <p className="text-xs ml-auto" style={{ color: 'oklch(0.40 0.02 40)' }}>{name.length}/100</p>
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label
              htmlFor="username"
              className="text-xs font-mono font-bold tracking-widest uppercase"
              style={{ color: 'oklch(0.72 0.20 42)' }}
            >
              Username
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@forger_handle"
              maxLength={50}
              className="forge-input"
              style={{
                background: 'oklch(0.14 0.012 28)',
                border: errors.username ? '1px solid oklch(0.55 0.22 25)' : '1px solid oklch(0.28 0.025 38)',
                color: 'oklch(0.88 0.02 60)',
              }}
            />
            <div className="flex justify-between">
              {errors.username && <p className="text-xs" style={{ color: 'oklch(0.65 0.22 25)' }}>{errors.username}</p>}
              <p className="text-xs ml-auto" style={{ color: 'oklch(0.40 0.02 40)' }}>{username.length}/50</p>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-mono font-bold tracking-widest uppercase"
              style={{ color: 'oklch(0.72 0.20 42)' }}
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="forge@example.com"
              maxLength={100}
              className="forge-input"
              style={{
                background: 'oklch(0.14 0.012 28)',
                border: errors.email ? '1px solid oklch(0.55 0.22 25)' : '1px solid oklch(0.28 0.025 38)',
                color: 'oklch(0.88 0.02 60)',
              }}
            />
            <div className="flex justify-between">
              {errors.email && <p className="text-xs" style={{ color: 'oklch(0.65 0.22 25)' }}>{errors.email}</p>}
              <p className="text-xs ml-auto" style={{ color: 'oklch(0.40 0.02 40)' }}>{email.length}/100</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saveProfile.isPending}
            className="w-full py-3 rounded-forge font-display font-bold tracking-widest uppercase text-sm transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, oklch(0.72 0.20 42) 0%, oklch(0.65 0.22 35) 100%)',
              color: 'oklch(0.10 0.01 30)',
            }}
          >
            {saveProfile.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Forging Profile...
              </>
            ) : (
              <>
                <User className="w-4 h-4" />
                Enter the Forge
              </>
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

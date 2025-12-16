import { useEffect, useState } from 'react';
import { Shield, Loader2, Save, Megaphone } from 'lucide-react';
import { useProfileStore } from '../store/useProfile';
import { updateUiConfig } from '../lib/experiments';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Admin() {
  const profile = useProfileStore((s) => s.profile);
  const [primaryButtonLabel, setPrimaryButtonLabel] = useState('');
  const [tickerMessage, setTickerMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [broadcast, setBroadcast] = useState('');
  const [sending, setSending] = useState(false);
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    // defaults
    setPrimaryButtonLabel('[ NEW DATA + ]');
    setTickerMessage('[' + 'SYSTEM: Experimental overlay active' + ']');
  }, []);

  const saveUi = async () => {
    setSaving(true);
    try {
      await updateUiConfig({
        primaryButtonLabel: primaryButtonLabel.trim() || undefined,
        tickerMessage: tickerMessage.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcast.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'events'), {
        type: 'broadcast',
        message: broadcast.trim(),
        createdAt: serverTimestamp(),
        createdBy: profile?.uid || 'admin',
      });
      setBroadcast('');
    } finally {
      setSending(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="border border-pandora-border bg-pandora-surface p-4 rounded-sm text-sm text-pandora-muted">
        Admin access only.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-pandora-text">
          <Shield size={18} className="text-pandora-neon" />
          <h2 className="text-lg font-semibold tracking-wide">Admin Console</h2>
        </div>
        <span className="text-xs text-pandora-muted font-mono uppercase">Experiments</span>
      </div>

      <div className="border border-pandora-border bg-pandora-surface p-4 rounded-sm space-y-3">
        <div className="text-xs uppercase text-pandora-muted font-semibold">UI Overrides</div>
        <div className="space-y-2">
          <label className="text-[11px] uppercase text-pandora-muted">Primary Button Label</label>
          <input
            value={primaryButtonLabel}
            onChange={(e) => setPrimaryButtonLabel(e.target.value)}
            className="w-full bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-3 rounded-sm font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-neon"
            placeholder="[ NEW DATA + ]"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[11px] uppercase text-pandora-muted">Ticker Message</label>
          <input
            value={tickerMessage}
            onChange={(e) => setTickerMessage(e.target.value)}
            className="w-full bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-3 rounded-sm font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-neon"
            placeholder="[SYSTEM: Experimental overlay active]"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={saveUi}
            disabled={saving}
            className="px-4 py-2 border border-pandora-neon text-pandora-neon bg-transparent font-semibold uppercase text-xs rounded-sm hover:bg-pandora-neon hover:text-pandora-bg transition disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save size={14} /> Save
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="border border-pandora-border bg-pandora-surface p-4 rounded-sm space-y-3">
        <div className="flex items-center gap-2 text-pandora-text">
          <Megaphone size={16} className="text-pandora-neon" />
          <div className="text-sm font-semibold">Broadcast Event</div>
        </div>
        <textarea
          value={broadcast}
          onChange={(e) => setBroadcast(e.target.value)}
          className="w-full h-24 bg-pandora-bg border border-pandora-border text-pandora-text text-sm p-3 rounded-sm font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-neon"
          placeholder="Message to all users"
        />
        <div className="flex justify-end">
          <button
            onClick={sendBroadcast}
            disabled={sending || !broadcast.trim()}
            className="px-4 py-2 border border-pandora-neon text-pandora-neon bg-transparent font-semibold uppercase text-xs rounded-sm hover:bg-pandora-neon hover:text-pandora-bg transition disabled:opacity-50"
          >
            {sending ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Sending...
              </span>
            ) : (
              'Broadcast'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

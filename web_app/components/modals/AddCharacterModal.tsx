"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoaderCircle } from "lucide-react";
import { postJson } from "@/lib/constants";

interface AddCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  log: (message: string, type?: "info" | "error" | "warn" | "success") => void;
}

const GEMINI_VOICES = [
  "Achernar",
  "Achird",
  "Algenib",
  "Algieba",
  "Alnilam",
  "Aoede",
  "Autonoe",
  "Callirrhoe",
  "Charon",
  "Despina",
  "Enceladus",
  "Erinome",
  "Fenrir",
  "Gacrux",
  "Iapetus",
  "Kore",
  "Laomedeia",
  "Leda",
  "Orus",
  "Pulcherrima",
  "Puck",
  "Rasalgethi",
  "Sadachbia",
  "Sadaltager",
  "Schedar",
  "Sulafat",
  "Umbriel",
  "Vindemiatrix",
  "Zephyr",
  "Zubenelgenubi",
];

export const AddCharacterModal: React.FC<AddCharacterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  log,
}) => {
  const [name, setName] = useState("");
  const [voiceGemini, setVoiceGemini] = useState("Rasalgethi");
  const [voiceEleven, setVoiceEleven] = useState("KSsyodh37PbfWy29kPtx");
  const [voiceMac, setVoiceMac] = useState("Aman");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await postJson("/api/characters", {
        name: name.trim(),
        voice_gemini: voiceGemini,
        voice_eleven: voiceEleven,
        voice_mac: voiceMac,
      });
      log(`Character ${name} added successfully`, "success");
      onSuccess();
      onClose();
      setName("");
    } catch (err: any) {
      log(`Failed to add character: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">
            Add Character
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Character Name
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John"
              required
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Gemini Voice
              </label>
              <Select value={voiceGemini} onValueChange={setVoiceGemini}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Gemini voice" />
                </SelectTrigger>
                <SelectContent>
                  {GEMINI_VOICES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest">
                ElevenLabs ID
              </label>
              <Input
                type="text"
                value={voiceEleven}
                onChange={(e) => setVoiceEleven(e.target.value)}
                placeholder="Voice ID"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Mac OS Voice
              </label>
              <Input
                type="text"
                value={voiceMac}
                onChange={(e) => setVoiceMac(e.target.value)}
                placeholder="e.g. Aman"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                "Save Character"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

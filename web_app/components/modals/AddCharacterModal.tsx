"use client";

import React, { useState } from "react";
import { postJson, CLEAN_INPUT, BTN_PRIMARY, BTN_SECONDARY } from "../../lib/constants";

interface AddCharacterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    log: (message: string, type?: "info" | "error" | "warn" | "success") => void;
}

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

    if (!isOpen) return null;

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-border w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-border flex justify-between items-center bg-secondary/30">
                    <h2 className="text-xl font-black text-foreground">Add Character</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-2">
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Character Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={CLEAN_INPUT}
                            placeholder="e.g. John"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Gemini Voice</label>
                            <select
                                value={voiceGemini}
                                onChange={(e) => setVoiceGemini(e.target.value)}
                                className={CLEAN_INPUT}
                            >
                                <option value="Achernar">Achernar (Female)</option>
                                <option value="Achird">Achird (Male)</option>
                                <option value="Algenib">Algenib (Male)</option>
                                <option value="Algieba">Algieba (Male)</option>
                                <option value="Alnilam">Alnilam (Male)</option>
                                <option value="Aoede">Aoede (Female)</option>
                                <option value="Autonoe">Autonoe (Female)</option>
                                <option value="Callirrhoe">Callirrhoe (Female)</option>
                                <option value="Charon">Charon (Male)</option>
                                <option value="Despina">Despina (Female)</option>
                                <option value="Enceladus">Enceladus (Male)</option>
                                <option value="Erinome">Erinome (Female)</option>
                                <option value="Fenrir">Fenrir (Male)</option>
                                <option value="Gacrux">Gacrux (Female)</option>
                                <option value="Iapetus">Iapetus (Male)</option>
                                <option value="Kore">Kore (Female)</option>
                                <option value="Laomedeia">Laomedeia (Female)</option>
                                <option value="Leda">Leda (Female)</option>
                                <option value="Orus">Orus (Male)</option>
                                <option value="Pulcherrima">Pulcherrima (Female)</option>
                                <option value="Puck">Puck (Male)</option>
                                <option value="Rasalgethi">Rasalgethi (Male)</option>
                                <option value="Sadachbia">Sadachbia (Male)</option>
                                <option value="Sadaltager">Sadaltager (Male)</option>
                                <option value="Schedar">Schedar (Male)</option>
                                <option value="Sulafat">Sulafat (Female)</option>
                                <option value="Umbriel">Umbriel (Male)</option>
                                <option value="Vindemiatrix">Vindemiatrix (Female)</option>
                                <option value="Zephyr">Zephyr (Female)</option>
                                <option value="Zubenelgenubi">Zubenelgenubi</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">ElevenLabs ID</label>
                            <input
                                type="text"
                                value={voiceEleven}
                                onChange={(e) => setVoiceEleven(e.target.value)}
                                className={CLEAN_INPUT}
                                placeholder="Voice ID"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Mac OS Voice</label>
                            <input
                                type="text"
                                value={voiceMac}
                                onChange={(e) => setVoiceMac(e.target.value)}
                                className={CLEAN_INPUT}
                                placeholder="e.g. Aman"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className={`${BTN_SECONDARY} flex-1`}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim()}
                            className={`${BTN_PRIMARY} flex-1`}
                        >
                            {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : "Save Character"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

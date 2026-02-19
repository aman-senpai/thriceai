"use client";

import React, { useState, useEffect } from "react";
import { fetchData, postData, postJson, BTN_SECONDARY } from "@/lib/constants";

interface Channel {
    name: string;
    channel_id: string;
    domain: string;
}

interface EditChannelsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    log: (msg: string, type: any) => void;
}

export const EditChannelsModal: React.FC<EditChannelsModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    log,
}) => {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadChannels();
        }
    }, [isOpen]);

    const loadChannels = async () => {
        setIsLoading(true);
        try {
            const data = await fetchData<{ channels: Channel[] }>("/api/rss/channels");
            setChannels(data.channels);
        } catch (err: any) {
            log(`Failed to load channels: ${err.message}`, "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await postJson("/api/rss/channels", channels);
            log("Channels updated successfully", "success");
            onSuccess?.();
            onClose();
        } catch (err: any) {
            log(`Failed to save channels: ${err.message}`, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const addChannel = () => {
        setChannels([...channels, { name: "", channel_id: "", domain: "Tech" }]);
    };

    const removeChannel = (index: number) => {
        setChannels(channels.filter((_, i) => i !== index));
    };

    const updateChannel = (index: number, field: keyof Channel, value: string) => {
        const newChannels = [...channels];
        newChannels[index][field] = value;
        setChannels(newChannels);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-border w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border flex justify-between items-center bg-secondary/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                            <i className="fas fa-rss text-lg"></i>
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight">Manage RSS Channels</h2>
                            <p className="text-xs text-muted-foreground font-medium">Add or edit YouTube channel IDs for the feed.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary transition-colors">
                        <i className="fas fa-times text-muted-foreground"></i>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <i className="fas fa-spinner fa-spin text-3xl text-primary/50"></i>
                        </div>
                    ) : (
                        <>
                            {channels.map((channel, index) => (
                                <div key={index} className="flex flex-col sm:flex-row gap-3 p-4 bg-secondary/20 rounded-2xl border border-border group relative">
                                    <div className="flex-1 space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Name</label>
                                                <input
                                                    type="text"
                                                    value={channel.name}
                                                    onChange={(e) => updateChannel(index, "name", e.target.value)}
                                                    placeholder="e.g. Varun Mayya"
                                                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Domain</label>
                                                <input
                                                    type="text"
                                                    value={channel.domain}
                                                    onChange={(e) => updateChannel(index, "domain", e.target.value)}
                                                    placeholder="e.g. AI & Tech"
                                                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Channel ID (UC...)</label>
                                            <input
                                                type="text"
                                                value={channel.channel_id}
                                                onChange={(e) => updateChannel(index, "channel_id", e.target.value)}
                                                placeholder="e.g. UCv75sKQatcyV0Zthp6zSg_g"
                                                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeChannel(index)}
                                        className="sm:self-center p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                                        title="Remove Channel"
                                    >
                                        <i className="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            ))}

                            <button
                                onClick={addChannel}
                                className="w-full py-4 border-2 border-dashed border-border rounded-2xl text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center gap-2 group"
                            >
                                <i className="fas fa-plus group-hover:scale-125 transition-transform"></i>
                                <span className="text-xs font-bold">Add New Channel</span>
                            </button>
                        </>
                    )}
                </div>

                <div className="p-6 border-t border-border bg-secondary/30 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-2xl font-bold text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isLoading}
                        className="flex-[2] py-3 px-4 rounded-2xl font-black text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <><i className="fas fa-spinner fa-spin"></i> Saving...</>
                        ) : (
                            <><i className="fas fa-save"></i> Save Changes</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

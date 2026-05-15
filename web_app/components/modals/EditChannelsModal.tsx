"use client";

import React, { useState, useEffect } from "react";
import { fetchData, postJson } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Rss, LoaderCircle, Trash2, Plus, Save } from "lucide-react";

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
      const data = await fetchData<{ channels: Channel[] }>(
        "/api/rss/channels",
      );
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

  const updateChannel = (
    index: number,
    field: keyof Channel,
    value: string,
  ) => {
    const newChannels = [...channels];
    newChannels[index][field] = value;
    setChannels(newChannels);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Rss className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black tracking-tight">
                Manage RSS Channels
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-medium">
                Add or edit YouTube channel IDs for the feed.
              </p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-4 py-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <LoaderCircle className="h-8 w-8 animate-spin text-primary/50" />
              </div>
            ) : (
              <>
                {channels.map((channel, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row gap-3 p-4 bg-secondary/20 rounded-2xl border border-border group relative"
                  >
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">
                            Name
                          </label>
                          <Input
                            type="text"
                            value={channel.name}
                            onChange={(e) =>
                              updateChannel(index, "name", e.target.value)
                            }
                            placeholder="e.g. Varun Mayya"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">
                            Domain
                          </label>
                          <Input
                            type="text"
                            value={channel.domain}
                            onChange={(e) =>
                              updateChannel(index, "domain", e.target.value)
                            }
                            placeholder="e.g. AI & Tech"
                            className="text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">
                          Channel ID (UC...)
                        </label>
                        <Input
                          type="text"
                          value={channel.channel_id}
                          onChange={(e) =>
                            updateChannel(index, "channel_id", e.target.value)
                          }
                          placeholder="e.g. UCv75sKQatcyV0Zthp6zSg_g"
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="self-center sm:self-center p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all shrink-0"
                      onClick={() => removeChannel(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="w-full py-6 border-2 border-dashed border-border rounded-2xl text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                  onClick={addChannel}
                >
                  <Plus className="h-4 w-4 mr-2 group-hover:scale-125 transition-transform" />
                  <span className="text-xs font-bold">Add New Channel</span>
                </Button>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-3 pt-4 border-t border-border mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-[2] font-black text-xs shadow-lg shadow-primary/20"
            onClick={handleSave}
            disabled={isSaving || isLoading}
          >
            {isSaving ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

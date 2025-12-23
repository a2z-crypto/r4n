import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Link2, Plus, Copy, ExternalLink, BarChart3, Trash2, 
  Globe, CheckCircle, XCircle, MousePointer2,
  Smartphone, Monitor, Tablet
} from "lucide-react";
import type { Deeplink, DeeplinkDomain } from "@shared/schema";

const createLinkSchema = z.object({
  destinationUrl: z.string().url("Please enter a valid URL"),
  title: z.string().optional(),
  shortCode: z.string().optional(),
  domainId: z.string().optional(),
  password: z.string().optional(),
  isActive: z.boolean(),
});

type CreateLinkFormData = z.infer<typeof createLinkSchema>;

const createDomainSchema = z.object({
  domain: z.string().min(1, "Domain is required").regex(/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/, "Please enter a valid domain"),
});

type CreateDomainFormData = z.infer<typeof createDomainSchema>;

export default function DeeplinksPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("links");
  const [createLinkOpen, setCreateLinkOpen] = useState(false);
  const [createDomainOpen, setCreateDomainOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<Deeplink | null>(null);

  const { data: deeplinks = [], isLoading: linksLoading } = useQuery<Deeplink[]>({
    queryKey: ["/api/deeplinks"],
  });

  const { data: domains = [], isLoading: domainsLoading } = useQuery<DeeplinkDomain[]>({
    queryKey: ["/api/deeplink-domains"],
  });

  const createLinkMutation = useMutation({
    mutationFn: async (data: Partial<Deeplink>) => {
      return apiRequest("POST", "/api/deeplinks", data);
    },
    onSuccess: () => {
      toast({ title: "Link created", description: "Your deeplink has been created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/deeplinks"] });
      setCreateLinkOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create link", description: error.message, variant: "destructive" });
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/deeplinks/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Link deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/deeplinks"] });
    },
  });

  const createDomainMutation = useMutation({
    mutationFn: async (data: { domain: string; isPrimary?: boolean }) => {
      return apiRequest("POST", "/api/deeplink-domains", data);
    },
    onSuccess: () => {
      toast({ title: "Domain added", description: "Your custom domain has been added" });
      queryClient.invalidateQueries({ queryKey: ["/api/deeplink-domains"] });
      setCreateDomainOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add domain", description: error.message, variant: "destructive" });
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/deeplink-domains/${id}/verify`);
    },
    onSuccess: () => {
      toast({ title: "Domain verified", description: "Your domain is now ready to use for short links" });
      queryClient.invalidateQueries({ queryKey: ["/api/deeplink-domains"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Verification failed", 
        description: error.message || "DNS TXT record not found. Please check your DNS settings and try again.",
        variant: "destructive" 
      });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/deeplink-domains/${id}/set-primary`);
    },
    onSuccess: () => {
      toast({ title: "Primary domain set" });
      queryClient.invalidateQueries({ queryKey: ["/api/deeplink-domains"] });
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/deeplink-domains/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Domain deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/deeplink-domains"] });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const getFullUrl = (link: Deeplink) => {
    const domain = domains.find(d => d.id === link.domainId);
    const baseUrl = domain?.domain || window.location.origin;
    return `${baseUrl.startsWith("http") ? "" : "https://"}${baseUrl}/l/${link.shortCode}`;
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Deeplinks</h1>
          <p className="text-muted-foreground">Create and manage trackable short links</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="links" data-testid="tab-links">
            <Link2 className="w-4 h-4 mr-2" />
            Links
          </TabsTrigger>
          <TabsTrigger value="domains" data-testid="tab-domains">
            <Globe className="w-4 h-4 mr-2" />
            Domains
          </TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={createLinkOpen} onOpenChange={setCreateLinkOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-link">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Deeplink</DialogTitle>
                  <DialogDescription>Create a new trackable short link</DialogDescription>
                </DialogHeader>
                <CreateLinkForm 
                  domains={domains} 
                  onSubmit={(data) => createLinkMutation.mutate(data)} 
                  isPending={createLinkMutation.isPending}
                  onClose={() => setCreateLinkOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>

          {linksLoading ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="status-loading-links">Loading links...</div>
          ) : deeplinks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Link2 className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No deeplinks yet</h3>
                <p className="text-muted-foreground mb-4">Create your first trackable link</p>
                <Button onClick={() => setCreateLinkOpen(true)} data-testid="button-create-first-link">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Link
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {deeplinks.map((link) => (
                <Card key={link.id} className="hover-elevate" data-testid={`card-link-${link.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium truncate" data-testid={`text-link-title-${link.id}`}>{link.title || link.shortCode}</h3>
                          {!link.isActive && <Badge variant="secondary" data-testid={`badge-inactive-${link.id}`}>Inactive</Badge>}
                          {link.password && <Badge variant="outline" data-testid={`badge-protected-${link.id}`}>Protected</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <code className="bg-muted px-2 py-0.5 rounded text-xs" data-testid={`text-short-url-${link.id}`}>{getFullUrl(link)}</code>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => copyToClipboard(getFullUrl(link))}
                            data-testid={`button-copy-link-${link.id}`}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate" data-testid={`text-destination-${link.id}`}>
                          {link.destinationUrl}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold" data-testid={`text-clicks-${link.id}`}>{link.clickCount}</div>
                          <div className="text-xs text-muted-foreground">Clicks</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold" data-testid={`text-unique-clicks-${link.id}`}>{link.uniqueClickCount}</div>
                          <div className="text-xs text-muted-foreground">Unique</div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSelectedLink(link)}
                            data-testid={`button-stats-${link.id}`}
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => window.open(link.destinationUrl, "_blank")}
                            data-testid={`button-open-${link.id}`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteLinkMutation.mutate(link.id)}
                            data-testid={`button-delete-${link.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="domains" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={createDomainOpen} onOpenChange={setCreateDomainOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-domain">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Domain
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Custom Domain</DialogTitle>
                  <DialogDescription>Add your own domain for branded short links</DialogDescription>
                </DialogHeader>
                <CreateDomainForm 
                  onSubmit={(data) => createDomainMutation.mutate(data)} 
                  isPending={createDomainMutation.isPending}
                  onClose={() => setCreateDomainOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>

          {domainsLoading ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="status-loading-domains">Loading domains...</div>
          ) : domains.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Globe className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No custom domains</h3>
                <p className="text-muted-foreground mb-4 text-center">
                  Add your own domain (like link.yoursite.com) for branded links
                </p>
                <Button onClick={() => setCreateDomainOpen(true)} data-testid="button-add-first-domain">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Domain
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {domains.map((domain) => (
                <Card key={domain.id} data-testid={`card-domain-${domain.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium" data-testid={`text-domain-${domain.id}`}>{domain.domain}</span>
                            {domain.isPrimary && <Badge variant="default" data-testid={`badge-primary-${domain.id}`}>Primary</Badge>}
                            {domain.isVerified ? (
                              <Badge variant="outline" className="text-green-600" data-testid={`badge-verified-${domain.id}`}>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-yellow-600" data-testid={`badge-unverified-${domain.id}`}>
                                <XCircle className="w-3 h-3 mr-1" />
                                Unverified
                              </Badge>
                            )}
                          </div>
                          {!domain.isVerified && domain.verificationToken && (
                            <div className="mt-2 p-3 bg-muted/50 rounded-md border" data-testid={`panel-verification-${domain.id}`}>
                              <p className="text-sm font-medium mb-2">DNS Verification Required</p>
                              <p className="text-xs text-muted-foreground mb-3">
                                Add a TXT record to your DNS settings to verify ownership of this domain.
                              </p>
                              <div className="space-y-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground w-16">Type:</span>
                                  <code className="bg-background px-2 py-1 rounded border font-mono">TXT</code>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground w-16">Host:</span>
                                  <code className="bg-background px-2 py-1 rounded border font-mono flex-1">_verify.{domain.domain}</code>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-6 px-2"
                                    onClick={() => copyToClipboard(`_verify.${domain.domain}`)}
                                    data-testid={`button-copy-host-${domain.id}`}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground w-16">Value:</span>
                                  <code className="bg-background px-2 py-1 rounded border font-mono flex-1 break-all">{domain.verificationToken}</code>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-6 px-2"
                                    onClick={() => copyToClipboard(domain.verificationToken!)}
                                    data-testid={`button-copy-token-${domain.id}`}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-3">
                                DNS changes may take up to 48 hours to propagate. Click Verify once your record is set.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {!domain.isVerified && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => verifyDomainMutation.mutate(domain.id)}
                            data-testid={`button-verify-${domain.id}`}
                          >
                            Verify
                          </Button>
                        )}
                        {domain.isVerified && !domain.isPrimary && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPrimaryMutation.mutate(domain.id)}
                            data-testid={`button-set-primary-${domain.id}`}
                          >
                            Set Primary
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteDomainMutation.mutate(domain.id)}
                          data-testid={`button-delete-domain-${domain.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <LinkStatsDialog link={selectedLink} onClose={() => setSelectedLink(null)} />
    </div>
  );
}

function CreateLinkForm({ 
  domains, 
  onSubmit, 
  isPending,
  onClose,
}: { 
  domains: DeeplinkDomain[]; 
  onSubmit: (data: Partial<Deeplink>) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const form = useForm<CreateLinkFormData>({
    resolver: zodResolver(createLinkSchema),
    defaultValues: {
      destinationUrl: "",
      title: "",
      shortCode: "",
      domainId: "none",
      password: "",
      isActive: true,
    },
  });

  const handleSubmit = (data: CreateLinkFormData) => {
    onSubmit({
      destinationUrl: data.destinationUrl,
      title: data.title || undefined,
      shortCode: data.shortCode || undefined,
      domainId: data.domainId && data.domainId !== "none" ? parseInt(data.domainId) : undefined,
      password: data.password || undefined,
      isActive: data.isActive,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="destinationUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Destination URL</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://example.com/page"
                  data-testid="input-destination-url"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="My Link"
                  data-testid="input-title"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="shortCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custom Short Code (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="my-link"
                    data-testid="input-short-code"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="domainId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Domain</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-domain">
                      <SelectValue placeholder="Default" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Default</SelectItem>
                    {domains.filter(d => d.isVerified).map((domain) => (
                      <SelectItem key={domain.id} value={String(domain.id)}>
                        {domain.domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password Protection (optional)</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Leave empty for no protection"
                  data-testid="input-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-active"
                />
              </FormControl>
              <FormLabel className="!mt-0">Active</FormLabel>
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="submit" disabled={isPending} data-testid="button-submit-link">
            {isPending ? "Creating..." : "Create Link"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function CreateDomainForm({ 
  onSubmit, 
  isPending,
  onClose,
}: { 
  onSubmit: (data: { domain: string; isPrimary?: boolean }) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const form = useForm<CreateDomainFormData>({
    resolver: zodResolver(createDomainSchema),
    defaultValues: {
      domain: "",
    },
  });

  const handleSubmit = (data: CreateDomainFormData) => {
    onSubmit({ domain: data.domain });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Domain</FormLabel>
              <FormControl>
                <Input
                  placeholder="link.yourdomain.com"
                  data-testid="input-domain"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                You'll need to add DNS records to verify ownership
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="submit" disabled={isPending} data-testid="button-submit-domain">
            {isPending ? "Adding..." : "Add Domain"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function LinkStatsDialog({ link, onClose }: { link: Deeplink | null; onClose: () => void }) {
  const { data: stats } = useQuery({
    queryKey: ["/api/deeplinks", link?.id, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/deeplinks/${link?.id}/stats`);
      return res.json();
    },
    enabled: !!link,
  });

  const { data: clicks = [] } = useQuery({
    queryKey: ["/api/deeplinks", link?.id, "clicks"],
    queryFn: async () => {
      const res = await fetch(`/api/deeplinks/${link?.id}/clicks?limit=20`);
      return res.json();
    },
    enabled: !!link,
  });

  if (!link) return null;

  return (
    <Dialog open={!!link} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle data-testid="text-stats-title">{link.title || link.shortCode} - Analytics</DialogTitle>
          <DialogDescription data-testid="text-stats-url">{link.destinationUrl}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <MousePointer2 className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold" data-testid="text-stat-total-clicks">{stats?.totalClicks || 0}</div>
                <div className="text-xs text-muted-foreground">Total Clicks</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <MousePointer2 className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold" data-testid="text-stat-unique-clicks">{stats?.uniqueClicks || 0}</div>
                <div className="text-xs text-muted-foreground">Unique Clicks</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Globe className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold" data-testid="text-stat-countries">{Object.keys(stats?.countries || {}).length}</div>
                <div className="text-xs text-muted-foreground">Countries</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Monitor className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold" data-testid="text-stat-devices">{Object.keys(stats?.devices || {}).length}</div>
                <div className="text-xs text-muted-foreground">Devices</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Devices</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.devices && Object.keys(stats.devices).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(stats.devices).map(([device, count], index) => (
                      <div key={device} className="flex items-center justify-between gap-2" data-testid={`row-device-${index}`}>
                        <div className="flex items-center gap-2">
                          {device === "mobile" && <Smartphone className="w-4 h-4" />}
                          {device === "desktop" && <Monitor className="w-4 h-4" />}
                          {device === "tablet" && <Tablet className="w-4 h-4" />}
                          <span className="capitalize">{device}</span>
                        </div>
                        <span className="text-muted-foreground">{count as number}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm" data-testid="text-no-devices">No data yet</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top Countries</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.countries && Object.keys(stats.countries).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(stats.countries)
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .slice(0, 5)
                      .map(([country, count], index) => (
                        <div key={country} className="flex items-center justify-between gap-2" data-testid={`row-country-${index}`}>
                          <span>{country || "Unknown"}</span>
                          <span className="text-muted-foreground">{count as number}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm" data-testid="text-no-countries">No data yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Clicks</CardTitle>
            </CardHeader>
            <CardContent>
              {clicks.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-auto">
                  {clicks.map((click: any, index: number) => (
                    <div key={click.id} className="flex items-center justify-between gap-2 text-sm border-b pb-2" data-testid={`row-click-${index}`}>
                      <div className="flex items-center gap-2">
                        {click.device === "mobile" && <Smartphone className="w-3 h-3" />}
                        {click.device === "desktop" && <Monitor className="w-3 h-3" />}
                        {click.device === "tablet" && <Tablet className="w-3 h-3" />}
                        <span data-testid={`text-click-browser-${index}`}>{click.browser}</span>
                        <span className="text-muted-foreground" data-testid={`text-click-os-${index}`}>/ {click.os}</span>
                      </div>
                      <span className="text-muted-foreground text-xs" data-testid={`text-click-time-${index}`}>
                        {new Date(click.clickedAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm" data-testid="text-no-clicks">No clicks yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

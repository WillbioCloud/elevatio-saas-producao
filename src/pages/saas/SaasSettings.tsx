import { useEffect, useState } from "react"
import {
  User,
  Settings as SettingsIcon,
  Link as LinkIcon,
  Shield,
  UploadCloud,
  CheckCircle2,
  XCircle,
  CreditCard,
  MessageSquare,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Separator } from "../../../components/ui/separator"
import { Skeleton } from "../../../components/ui/skeleton"
import { cn } from "@/lib/utils"
import { supabase } from '@/lib/supabase'

type TabType = "perfil" | "plataforma" | "integracoes" | "seguranca"

type SettingsState = {
  app_name: string
  support_email: string
  payment_gateway: string
  gateway_public_key: string
  gateway_secret_key: string
}

const initialSettings: SettingsState = {
  app_name: "",
  support_email: "",
  payment_gateway: "stripe",
  gateway_public_key: "",
  gateway_secret_key: "",
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>("plataforma")
  const [adminEmail, setAdminEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [settings, setSettings] = useState<SettingsState>(initialSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true)
      const { data } = await supabase.auth.getUser()
      setAdminEmail(data.user?.email ?? "")
      const { data: settingsData, error } = await supabase
        .from("super_admin_settings")
        .select("*")
        .eq("id", 1)
        .single()
      if (!error && settingsData) {
        setSettings({
          app_name: settingsData.app_name ?? "",
          support_email: settingsData.support_email ?? "",
          payment_gateway: settingsData.payment_gateway ?? "stripe",
          gateway_public_key: settingsData.gateway_public_key ?? "",
          gateway_secret_key: settingsData.gateway_secret_key ?? "",
        })
      }
      setIsLoading(false)
    }
    loadSettings()
  }, [])

  const handleUpdateProfile = async () => {
    if (!newPassword.trim()) {
      alert("Informe uma nova senha para atualizar.")
      return
    }
    setIsSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) alert("Não foi possível atualizar a senha. Tente novamente.")
    else {
      alert("Senha atualizada com sucesso!")
      setNewPassword("")
    }
    setIsSaving(false)
  }

  const handleUpdateSettings = async () => {
    setIsSaving(true)
    const { error } = await supabase
      .from("super_admin_settings")
      .update(settings)
      .eq("id", 1)
    if (error) alert("Não foi possível guardar as configurações.")
    else alert("Configurações guardadas com sucesso!")
    setIsSaving(false)
  }

  const tabs = [
    { id: "perfil", label: "Perfil", icon: User },
    { id: "plataforma", label: "Plataforma", icon: SettingsIcon },
    { id: "integracoes", label: "Integrações", icon: LinkIcon },
    { id: "seguranca", label: "Segurança", icon: Shield },
  ]

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <Skeleton className="h-10 w-64" />
        <div className="flex flex-col md:flex-row gap-8">
          <Skeleton className="w-full md:w-64 h-64 rounded-2xl" />
          <Skeleton className="flex-1 h-96 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Definições do Sistema</h2>
        <p className="text-sm text-muted-foreground mt-1">Gira as configurações globais, integrações e segurança do ArkCoder.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {/* Perfil */}
          {activeTab === "perfil" && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Perfil do Super Admin</CardTitle>
                <CardDescription>Gerencie os dados de autenticação da conta principal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-2">
                  <Label htmlFor="adminEmail">Email atual</Label>
                  <Input id="adminEmail" type="email" value={adminEmail} disabled className="bg-muted/50" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">Nova senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Digite uma nova senha"
                    className="max-w-md"
                  />
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/50 pt-6">
                <Button onClick={handleUpdateProfile} disabled={isSaving} className="gap-2">
                  {isSaving ? "A guardar..." : "Guardar Alterações"}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Plataforma */}
          {activeTab === "plataforma" && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Detalhes da Plataforma</CardTitle>
                <CardDescription>Configure as informações principais do seu SaaS.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-2">
                  <Label htmlFor="saasName">Nome do SaaS</Label>
                  <Input
                    id="saasName"
                    value={settings.app_name}
                    onChange={(event) => setSettings((prev) => ({ ...prev, app_name: event.target.value }))}
                    className="max-w-md"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactEmail">Email de Contato Geral</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={settings.support_email}
                    onChange={(event) => setSettings((prev) => ({ ...prev, support_email: event.target.value }))}
                    className="max-w-md"
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Logotipo da Plataforma</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-muted/30 transition-colors cursor-pointer group">
                    <div className="bg-primary/10 p-3 rounded-full mb-4 group-hover:scale-110 transition-transform">
                      <UploadCloud className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium mb-1">Clique para fazer upload ou arraste e solte</p>
                    <p className="text-xs text-muted-foreground">SVG, PNG, JPG ou GIF (max. 2MB)</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/50 pt-6">
                <Button onClick={handleUpdateSettings} disabled={isSaving} className="gap-2">
                  {isSaving ? "A guardar..." : "Guardar Alterações"}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Integrações */}
          {activeTab === "integracoes" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-1">Integrações de API</h3>
                <p className="text-sm text-muted-foreground mb-6">Configure os serviços externos conectados à plataforma.</p>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Stripe / MercadoPago */}
                <Card className="border-border/50 shadow-sm flex flex-col">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-md">
                          <CreditCard className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Gateway de Pagamento</CardTitle>
                          <CardDescription className="text-xs mt-0.5">Stripe / MercadoPago</CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Conectado
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Gateway</Label>
                      <select
                        value={settings.payment_gateway}
                        onChange={(event) => setSettings((prev) => ({ ...prev, payment_gateway: event.target.value }))}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="stripe">Stripe</option>
                        <option value="mercadopago">MercadoPago</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">API Key (Public)</Label>
                      <Input
                        value={settings.gateway_public_key}
                        onChange={(event) => setSettings((prev) => ({ ...prev, gateway_public_key: event.target.value }))}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">API Key (Secret)</Label>
                      <Input
                        type="password"
                        value={settings.gateway_secret_key}
                        onChange={(event) => setSettings((prev) => ({ ...prev, gateway_secret_key: event.target.value }))}
                        className="font-mono text-sm"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-border/50">
                    <Button variant="outline" size="sm" onClick={handleUpdateSettings} disabled={isSaving} className="w-full">
                      {isSaving ? "A guardar..." : "Atualizar Chave"}
                    </Button>
                  </CardFooter>
                </Card>

                {/* WhatsApp API */}
                <Card className="border-border/50 shadow-sm flex flex-col">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-md">
                          <MessageSquare className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <CardTitle className="text-base">API do WhatsApp</CardTitle>
                          <CardDescription className="text-xs mt-0.5">Z-API / Evolution API</CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 gap-1">
                        <XCircle className="h-3.5 w-3.5" /> Desconectado
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-2">
                      <Label className="text-xs">Token de Acesso</Label>
                      <Input placeholder="Cole o seu token aqui..." className="font-mono text-sm" />
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-border/50">
                    <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                      Salvar e Conectar
                    </Button>
                  </CardFooter>
                </Card>

                {/* SendGrid */}
                <Card className="border-border/50 shadow-sm flex flex-col">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-md">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Serviço de E-mail</CardTitle>
                          <CardDescription className="text-xs mt-0.5">SendGrid / AWS SES</CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Conectado
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-2">
                      <Label className="text-xs">API Key</Label>
                      <Input type="password" defaultValue="SG.xyz123..." className="font-mono text-sm" />
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-border/50">
                    <Button variant="outline" size="sm" className="w-full">
                      Atualizar Chave
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          )}

          {/* Segurança */}
          {activeTab === "seguranca" && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Segurança da Conta</CardTitle>
                <CardDescription>Atualize a senha da conta Super Admin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-2">
                  <Label htmlFor="securityEmail">Email atual</Label>
                  <Input id="securityEmail" type="email" value={adminEmail} disabled className="bg-muted/50" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="securityPassword">Nova senha</Label>
                  <Input
                    id="securityPassword"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Digite uma nova senha"
                    className="max-w-md"
                  />
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/50 pt-6">
                <Button onClick={handleUpdateProfile} disabled={isSaving} className="gap-2">
                  {isSaving ? "A guardar..." : "Guardar Alterações"}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
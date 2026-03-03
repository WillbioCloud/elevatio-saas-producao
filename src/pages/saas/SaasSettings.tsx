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

    if (error) {
      alert("Não foi possível atualizar a senha. Tente novamente.")
    } else {
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

    if (error) {
      alert("Não foi possível guardar as configurações.")
    } else {
      alert("Configurações guardadas com sucesso!")
    }

    setIsSaving(false)
  }

  const tabs = [
    { id: "perfil", label: "Perfil", icon: User },
    { id: "plataforma", label: "Plataforma", icon: SettingsIcon },
    { id: "integracoes", label: "Integrações", icon: LinkIcon },
    { id: "seguranca", label: "Segurança", icon: Shield },
  ]

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Definições do Sistema</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gira as configurações globais, integrações e segurança do ArkCoder.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                  activeTab === tab.id
                    ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-200"
                )}
              >
                <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500")} />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {activeTab === "perfil" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-900 dark:text-slate-50">Perfil do Super Admin</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">Gerencie os dados de autenticação da conta principal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="adminEmail" className="text-slate-700 dark:text-slate-200">Email atual</Label>
                      <Input
                        id="adminEmail"
                        type="email"
                        value={adminEmail}
                        disabled
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white max-w-md"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="newPassword" className="text-slate-700 dark:text-slate-200">Nova senha</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="Digite uma nova senha"
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white max-w-md"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-slate-100 dark:border-slate-800/50 pt-6">
                  <Button
                    onClick={handleUpdateProfile}
                    disabled={isSaving || isLoading}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  >
                    {isSaving ? "A guardar..." : "Guardar Alterações"}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {activeTab === "plataforma" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-900 dark:text-slate-50">Detalhes da Plataforma</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">Configure as informações principais do seu SaaS.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="saasName" className="text-slate-700 dark:text-slate-200">Nome do SaaS</Label>
                      <Input
                        id="saasName"
                        value={settings.app_name}
                        onChange={(event) => setSettings((prev) => ({ ...prev, app_name: event.target.value }))}
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white max-w-md"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contactEmail" className="text-slate-700 dark:text-slate-200">Email de Contato Geral</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={settings.support_email}
                        onChange={(event) => setSettings((prev) => ({ ...prev, support_email: event.target.value }))}
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white max-w-md"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-200">Logotipo da Plataforma</Label>
                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-950/50 transition-colors cursor-pointer group">
                      <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-full mb-4 group-hover:scale-110 transition-transform">
                        <UploadCloud className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-50 mb-1">Clique para fazer upload ou arraste e solte</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">SVG, PNG, JPG ou GIF (max. 2MB)</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-slate-100 dark:border-slate-800/50 pt-6">
                  <Button
                    onClick={handleUpdateSettings}
                    disabled={isSaving || isLoading}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  >
                    {isSaving ? "A guardar..." : "Guardar Alterações"}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {activeTab === "integracoes" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-50 mb-1">Integrações de API</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Configure os serviços externos conectados à plataforma.</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Stripe / MercadoPago */}
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 flex flex-col">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                          <CreditCard className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                        </div>
                        <div>
                          <CardTitle className="text-base text-slate-900 dark:text-slate-50">Gateway de Pagamento</CardTitle>
                          <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Stripe / MercadoPago</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Conectado
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2">
                    <div className="space-y-2">
                      <Label htmlFor="gatewayType" className="text-xs text-slate-600 dark:text-slate-300">Gateway</Label>
                      <select
                        id="gatewayType"
                        value={settings.payment_gateway}
                        onChange={(event) => setSettings((prev) => ({ ...prev, payment_gateway: event.target.value }))}
                        className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="stripe">Stripe</option>
                        <option value="mercadopago">MercadoPago</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gatewayPublicKey" className="text-xs text-slate-600 dark:text-slate-300">API Key (Public)</Label>
                      <Input
                        id="gatewayPublicKey"
                        value={settings.gateway_public_key}
                        onChange={(event) => setSettings((prev) => ({ ...prev, gateway_public_key: event.target.value }))}
                        className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 dark:text-white font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stripeKey" className="text-xs text-slate-600 dark:text-slate-300">API Key (Secret)</Label>
                      <Input
                        id="stripeKey"
                        type="password"
                        value={settings.gateway_secret_key}
                        onChange={(event) => setSettings((prev) => ({ ...prev, gateway_secret_key: event.target.value }))}
                        className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 dark:text-white font-mono text-sm"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-slate-100 dark:border-slate-800/50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUpdateSettings}
                      disabled={isSaving || isLoading}
                      className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                    >
                      {isSaving ? "A guardar..." : "Atualizar Chave"}
                    </Button>
                  </CardFooter>
                </Card>

                {/* WhatsApp API */}
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 flex flex-col">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                          <MessageSquare className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                        </div>
                        <div>
                          <CardTitle className="text-base text-slate-900 dark:text-slate-50">API do WhatsApp</CardTitle>
                          <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Z-API / Evolution API</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                        <XCircle className="h-3.5 w-3.5" />
                        Desconectado
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-2">
                      <Label htmlFor="wppKey" className="text-xs text-slate-600 dark:text-slate-300">Token de Acesso</Label>
                      <Input id="wppKey" placeholder="Cole o seu token aqui..." className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 dark:text-white font-mono text-sm" />
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-slate-100 dark:border-slate-800/50">
                    <Button size="sm" className="w-full bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600">
                      Salvar e Conectar
                    </Button>
                  </CardFooter>
                </Card>

                {/* SendGrid */}
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 flex flex-col">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                          <Mail className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                        </div>
                        <div>
                          <CardTitle className="text-base text-slate-900 dark:text-slate-50">Serviço de E-mail</CardTitle>
                          <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">SendGrid / AWS SES</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Conectado
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-2">
                      <Label htmlFor="sendgridKey" className="text-xs text-slate-600 dark:text-slate-300">API Key</Label>
                      <Input id="sendgridKey" type="password" defaultValue="SG.xyz123..." className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 dark:text-white font-mono text-sm" />
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-slate-100 dark:border-slate-800/50">
                    <Button variant="outline" size="sm" className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                      Atualizar Chave
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "seguranca" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-900 dark:text-slate-50">Segurança da Conta</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">Atualize a senha da conta Super Admin.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="securityEmail" className="text-slate-700 dark:text-slate-200">Email atual</Label>
                      <Input
                        id="securityEmail"
                        type="email"
                        value={adminEmail}
                        disabled
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white max-w-md"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="securityPassword" className="text-slate-700 dark:text-slate-200">Nova senha</Label>
                      <Input
                        id="securityPassword"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="Digite uma nova senha"
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white max-w-md"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-slate-100 dark:border-slate-800/50 pt-6">
                  <Button
                    onClick={handleUpdateProfile}
                    disabled={isSaving || isLoading}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  >
                    {isSaving ? "A guardar..." : "Guardar Alterações"}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
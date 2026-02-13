
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export default function DesignSystemPage() {
    return (
        <div className="container mx-auto py-10 space-y-10">
            <div className="space-y-4">
                <h1 className="text-3xl font-bold">Design System</h1>
                <p className="text-muted-foreground">Verification of the new theme and components.</p>
            </div>

            <Separator />

            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Buttons</h2>
                <div className="flex flex-wrap gap-4">
                    <Button variant="default">Default</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="destructive">Destructive</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="link">Link</Button>
                </div>
            </section>

            <Separator />

            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Inputs</h2>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input type="email" id="email" placeholder="Email" />
                </div>
            </section>

            <Separator />

            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Cards</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Card Title</CardTitle>
                            <CardDescription>Card Description</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p>Card Content</p>
                        </CardContent>
                        <CardFooter>
                            <Button>Action</Button>
                        </CardFooter>
                    </Card>

                    <Card className="bg-sidebar text-sidebar-foreground border-sidebar-border">
                        <CardHeader>
                            <CardTitle>Sidebar Card</CardTitle>
                            <CardDescription className="text-sidebar-foreground/70">Testing sidebar colors</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p>Content on sidebar background</p>
                        </CardContent>
                        <CardFooter>
                            <Button variant="secondary">Sidebar Action</Button>
                        </CardFooter>
                    </Card>
                </div>
            </section>
        </div>
    )
}

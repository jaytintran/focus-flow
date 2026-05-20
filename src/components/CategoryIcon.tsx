import React from "react";
import {
	Briefcase,
	User,
	Heart,
	Book,
	DollarSign,
	ShoppingBag,
	Play,
	Gamepad2,
	Home,
	Coffee,
	Code,
	Music,
	Camera,
	Flame,
	Globe,
	Zap,
	Tag,

	// NEW
	Dumbbell,
	Brain,
	Moon,
	Sun,
	Droplets,
	Apple,
	NotebookPen,
	BookOpen,
	Target,
	Timer,
	Footprints,
	Medal,
	Wallet,
	GraduationCap,
	Headphones,
	Mic,
	Palette,
	Plane,
	Bike,
	Smartphone,
	Shield,
	Sparkles,
} from "lucide-react";

export const CATEGORY_ICONS = {
	Briefcase,
	User,
	Heart,
	Book,
	DollarSign,
	ShoppingBag,
	Play,
	Gamepad2,
	Home,
	Coffee,
	Code,
	Music,
	Camera,
	Flame,
	Globe,
	Zap,
	Tag,

	// Lifestyle
	Dumbbell,
	Brain,
	Moon,
	Sun,
	Droplets,
	Apple,

	// Productivity
	NotebookPen,
	BookOpen,
	Target,
	Timer,
	Wallet,
	Shield,

	// Activities
	Footprints,
	Bike,
	Plane,
	Palette,
	Mic,
	Headphones,

	// Achievement
	Medal,
	GraduationCap,
	Sparkles,

	// Devices
	Smartphone,
};

export type IconName = keyof typeof CATEGORY_ICONS;

interface CategoryIconProps {
	name?: string;
	className?: string;
	style?: React.CSSProperties;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
	name,
	className,
}) => {
	const IconComponent = (name && CATEGORY_ICONS[name as IconName]) || Tag;
	return <IconComponent className={className} />;
};

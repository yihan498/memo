// 窗口右上沿的桌面宠物：点一下打招呼（眨眼、天线晃一下、腮红一闪）
// 动画和时长照搬原设计稿 robot-companion-interactive.svg；颜色从主题变量取，深浅主题都对
export class Pet {
    constructor() {
        this.el = document.getElementById('pet');
        if (!this.el) return;
        this.eyes = this.el.querySelectorAll('.pet-eye');
        this.antenna = this.el.querySelector('#petAntenna');
        this.cheeks = this.el.querySelector('#petCheeks');
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.animations = [];
        this.el.addEventListener('click', () => this.greet());
    }

    greet() {
        this.animations.forEach(a => a.cancel());
        const css = getComputedStyle(document.documentElement);
        const base = css.getPropertyValue('--accent').trim();
        const glow = css.getPropertyValue('--pet-glow').trim();
        this.animations = [this.cheeks.animate(
            [{ stroke: base }, { stroke: glow }, { stroke: base }],
            { duration: 440, easing: 'ease-in-out' }
        )];
        if (this.reducedMotion.matches) return;

        for (const eye of this.eyes) {
            this.animations.push(eye.animate(
                [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.12)' }, { transform: 'scaleY(1)' }],
                { duration: 240, easing: 'ease-in-out' }
            ));
        }
        this.animations.push(this.antenna.animate(
            [{ transform: 'rotate(0deg)' }, { transform: 'rotate(9deg)' },
             { transform: 'rotate(-6deg)' }, { transform: 'rotate(0deg)' }],
            { duration: 520, easing: 'ease-in-out' }
        ));
    }
}

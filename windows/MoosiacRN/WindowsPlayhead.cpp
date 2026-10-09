#include "pch.h"
#include "WindowsPlayhead.h"
#include <winrt/Microsoft.ReactNative.Composition.Experimental.h>
#include <NativeModules.h>
#include <JSValueComposition.h>
#include <algorithm>
#include <chrono>
#include <cmath>
#include <vector>

namespace {
namespace RN = winrt::Microsoft::ReactNative;
namespace Exp = RN::Composition::Experimental;
namespace Comp = winrt::Microsoft::UI::Composition;

REACT_STRUCT(PlayheadProps)
struct PlayheadProps : winrt::implements<PlayheadProps, RN::IComponentProps> {
  PlayheadProps(RN::ViewProps props, RN::IComponentProps const &clone) : ViewProps(props) {
    if (clone) {
      auto from = clone.as<PlayheadProps>();
      times = from->times; positions = from->positions; sentAt = from->sentAt;
      lineTop = from->lineTop; lineHeight = from->lineHeight; lineColor = from->lineColor;
      scrollLeft = from->scrollLeft; scrollTop = from->scrollTop; clipLeft = from->clipLeft;
    }
  }
  void SetProp(uint32_t hash, winrt::hstring name, RN::IJSValueReader value) noexcept {
    RN::ReadProp(hash, name, value, *this);
  }
  REACT_FIELD(times) std::vector<double> times;
  REACT_FIELD(positions) std::vector<double> positions;
  REACT_FIELD(sentAt) double sentAt = 0;
  REACT_FIELD(lineTop) double lineTop = 0;
  REACT_FIELD(lineHeight) double lineHeight = 0;
  REACT_FIELD(lineColor) double lineColor = 0;
  REACT_FIELD(scrollLeft) double scrollLeft = 0;
  REACT_FIELD(scrollTop) double scrollTop = 0;
  REACT_FIELD(clipLeft) double clipLeft = 0;
  const RN::ViewProps ViewProps;
};

struct PlayheadView : winrt::implements<PlayheadView, winrt::Windows::Foundation::IInspectable> {
  explicit PlayheadView(Exp::ICompositionContext context) : m_context(context) {}
  void Initialize(RN::ComponentView const &view) {
    m_view = view;
    view.as<Exp::IInternalCreateVisual>().CreateInternalVisualHandler(
      [weak = get_weak()](RN::ComponentView const &) {
        auto self = weak.get();
        return self ? self->CreateVisual() : Exp::IVisual{nullptr};
      });
    view.LayoutMetricsChanged([weak = get_weak()](auto const &, RN::LayoutMetricsChangedArgs const &args) {
      if (auto self = weak.get()) { self->m_layout = args.NewLayoutMetrics(); self->Invalidate(); }
    });
  }
  Exp::IVisual CreateVisual() {
    auto compositor = Exp::MicrosoftCompositionContextHelper::InnerCompositor(m_context);
    m_root = compositor.CreateContainerVisual();
    m_line = compositor.CreateSpriteVisual();
    m_root.Children().InsertAtTop(m_line);
    Invalidate();
    return Exp::MicrosoftCompositionContextHelper::CreateVisual(m_root);
  }
  void UpdateProps(winrt::com_ptr<PlayheadProps> props) { m_props = props; Invalidate(); }
 private:
  void Invalidate() {
    if (m_pending) return;
    auto view = m_view.get();
    if (!view) return;
    m_pending = true;
    view.ReactContext().UIDispatcher().Post([weak = get_weak()] {
      if (auto self = weak.get()) { self->m_pending = false; self->Apply(); }
    });
  }
  void Apply() noexcept {
    if (!m_root || !m_line) return;
    try {
      m_line.StopAnimation(L"Offset");
      auto p = m_props;
      if (!p || p->times.empty() || p->times.size() != p->positions.size() || p->lineHeight <= 0) {
        m_line.Opacity(0); return;
      }
      for (size_t i = 0; i < p->times.size(); ++i) {
        if (!std::isfinite(p->times[i]) || !std::isfinite(p->positions[i]) ||
            (i && p->times[i] <= p->times[i - 1])) { m_line.Opacity(0); return; }
      }
      const float scale = m_layout.PointScaleFactor > 0 ? m_layout.PointScaleFactor : 1;
      auto compositor = m_root.Compositor();
      m_root.Size({m_layout.Frame.Width * scale, m_layout.Frame.Height * scale});
      auto clip = compositor.CreateInsetClip();
      clip.LeftInset(static_cast<float>(p->clipLeft) * scale);
      m_root.Clip(clip);
      const auto argb = static_cast<uint32_t>(p->lineColor);
      m_line.Brush(compositor.CreateColorBrush({static_cast<uint8_t>(argb >> 24),
          static_cast<uint8_t>(argb >> 16), static_cast<uint8_t>(argb >> 8), static_cast<uint8_t>(argb)}));
      m_line.Size({2 * scale, static_cast<float>(p->lineHeight) * scale});
      m_line.Opacity(1);
      // RNW's nativePerformanceNow uses this same monotonic clock. Account
      // for the time spent delivering props instead of restarting at sentAt.
      const double now = std::chrono::duration<double, std::milli>(
          std::chrono::steady_clock::now().time_since_epoch()).count();
      const double elapsed = std::max(0.0, now - p->sentAt);
      auto next = std::upper_bound(p->times.begin(), p->times.end(), elapsed);
      const size_t index = static_cast<size_t>(next - p->times.begin());
      double x = p->positions.back();
      if (index < p->times.size()) {
        if (index == 0) x = p->positions.front();
        else {
          const double fraction = (elapsed - p->times[index - 1]) / (p->times[index] - p->times[index - 1]);
          x = p->positions[index - 1] + fraction * (p->positions[index] - p->positions[index - 1]);
        }
      }
      const auto offset = [&](double position) {
        return winrt::Windows::Foundation::Numerics::float3{
          static_cast<float>(position - p->scrollLeft - 1) * scale,
          static_cast<float>(p->lineTop - p->scrollTop) * scale, 0};
      };
      m_line.Offset(offset(x));
      const double remaining = p->times.back() - elapsed;
      if (remaining < 1) return;
      auto animation = compositor.CreateVector3KeyFrameAnimation();
      auto linear = compositor.CreateLinearEasingFunction();
      animation.InsertKeyFrame(0, offset(x), linear);
      for (size_t i = index; i < p->times.size(); ++i) {
        const float progress = static_cast<float>((p->times[i] - elapsed) / remaining);
        animation.InsertKeyFrame(std::clamp(progress, 0.0f, 1.0f), offset(p->positions[i]), linear);
      }
      animation.Duration(std::chrono::microseconds(static_cast<int64_t>(remaining * 1000)));
      animation.StopBehavior(Comp::AnimationStopBehavior::LeaveCurrentValue);
      m_line.StartAnimation(L"Offset", animation);
    } catch (winrt::hresult_error const &) {
      // An invalid visual must not terminate the audio engine or its host.
      m_line.Opacity(0);
    }
  }
  Exp::ICompositionContext m_context{nullptr};
  Comp::ContainerVisual m_root{nullptr};
  Comp::SpriteVisual m_line{nullptr};
  winrt::weak_ref<RN::ComponentView> m_view;
  RN::LayoutMetrics m_layout{{0, 0, 0, 0}, 1};
  winrt::com_ptr<PlayheadProps> m_props;
  bool m_pending = false;
};
}

void RegisterWindowsPlayhead(RN::IReactPackageBuilder const &packageBuilder) noexcept {
  packageBuilder.as<RN::IReactPackageBuilderFabric>().AddViewComponent(
    L"MoosiacWindowsPlayhead", [](RN::IReactViewComponentBuilder const &builder) noexcept {
      builder.SetCreateProps([](RN::ViewProps props, RN::IComponentProps const &clone) noexcept {
        return winrt::make<PlayheadProps>(props, clone);
      });
      builder.SetUpdatePropsHandler([](RN::ComponentView const &view, RN::IComponentProps const &props,
                                       RN::IComponentProps const &) noexcept {
        winrt::get_self<PlayheadView>(view.UserData())->UpdateProps(props ? props.as<PlayheadProps>() : nullptr);
      });
      auto comp = builder.as<RN::Composition::IReactCompositionViewComponentBuilder>();
      comp.SetViewComponentViewInitializer([](RN::ComponentView const &view) noexcept {
        auto data = winrt::make_self<PlayheadView>(view.as<Exp::IInternalComponentView>().CompositionContext());
        data->Initialize(view); view.UserData(*data);
      });
      comp.SetViewFeatures(RN::Composition::ComponentViewFeatures::Default &
                          ~RN::Composition::ComponentViewFeatures::Background);
    });
}

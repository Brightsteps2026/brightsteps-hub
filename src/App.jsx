import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { LayoutDashboard, Users, BookOpen, ClipboardList, Megaphone, Plus, X, Trash2, CheckSquare, ClipboardCheck, Settings as SettingsIcon, Calendar as CalendarIcon, UserCheck, Menu as MenuIcon, UserPlus, FileText, FileCheck, Flag, Percent, Briefcase, FolderOpen, Award, Sparkles, Send, LogOut, Bell, Utensils, Wallet } from "lucide-react";
import AttachmentField from "./AttachmentField";
import StudentPhotoField from "./StudentPhotoField";
import { getAttachmentUrl } from "./lib/attachments";
import { useAuth } from "./LoginGate";
import { LanguageProvider, useLanguage } from "./lib/i18n";
import { supabase } from "./lib/supabaseClient";
import CanteenTab from "./CanteenTab";

let GRADES = [
  "Pre-N", "PreK", "Kindergarten",
  "Grade 1", "Grade 2", "Grade 3", "Grade 4",
  "Grade 5", "Grade 6", "Grade 7"
];

const TAGS = ["Inquiry", "Literacy", "Numeracy", "Social Emotional", "Creative Arts", "Physical"];

const THEMES = [
  "Who We Are",
  "How We Express Ourselves",
  "How the World Works",
  "How We Organize Ourselves",
  "Sharing the Planet",
  "Where We Are in Place and Time"
];

const PLAN_TEMPLATE = {
  centralIdea: "Students will understand that ",
  keyConcepts: "Form, Change, Connection",
  linesOfInquiry: "An exploration of \nA connection between \nThe way that "
};

let ASSESS_LEVELS = ["Emerging", "Developing", "Proficient", "Confident"];
const LEVEL_PALETTE = ["#B5473B", "#B8842F", "#2F6B7A", "#2F7A5C", "#6E4E9E", "#3A6EA5"];
const getLevelColor = (level) => {
  const idx = ASSESS_LEVELS.indexOf(level);
  return LEVEL_PALETTE[idx >= 0 ? idx % LEVEL_PALETTE.length : 0];
};

const BRIGHTSTEPS_LOGO_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAADwCAYAAAA+VemSAAAzFElEQVR42u29eZwlVXnw/31O1V17mZ6dAdn3TRTckNVAJPoSY0zA3TeiAoZE4wK+GiOOhoTXn1uimMQdFTHMG6OJiQsuEDdAQVkGZF9n33p6erlbnef3R52aW33ndk/3zAA93c/386nP7Vt1uupU3fOcZznPOQWGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRiGYRjG3obM6rtTlZn/9EVnT1s6I5q51VuisMIDamI/0znvumjvqapGs6Ajdaa07Gb2nNaVVKsdf82j89m6dUZWMyk46Z/XP3bT+QeMzQLh9UcdcNSyUV99Bd4vmGFNXAXUxXrvQ4/+9t9E0NDu1QR4pnG5OpaLP/YTvz7HVfuv8K3Ggb7VcDPOlBZREVGJCmO+UfvXe7520Xvp7VVuvCHZu0zqyx0s9/vu++yXjdbjz22rca9XNoDKzLmP9Lcvxu7o3pIfmucaf/jQujs2ZAdNgGeY8B7/iduP1HLhDomLRd+sE/cMINHMtKhVoTCwGK3XPnzrn/Z84KQL/6Vw62cvau5NbefAA5+7dGg4eeD0w+qf/dZlj92AqBAnfuaYOoCLXH1VMT7xowdcvmbIPTK48baXKedFsCLZ25t9PFvk9wxucDeCT2J5eVzuKSZjww3xSWHzDz5P7fGVqbSgM6fPFUDVi4s18a1LiKIf3/rZi27ITNK94IlHwo2t1ev09087qlX+1sVPvJatxXeATK328hSqD4VST8K//tmawbOu2u/gvme8YMHQEys2zwZTetYIcLtdJD1IpFobdo988o2SjG6l57CTwGcByJlkdGiEi7Q1PFjC6/eAq4B37T1CDM0WfQfM9xGJLNkyqkksqn1lYCdGT6MB9SaIPPkSpArFCJlX1oHeotbWb2j1ACbAMxGftLRU7ZMnPv1BcBFHXvk/UCjN2OpKXHKIrFp56XPPa656+FaIrofke0EE9gITT7SZdjVNgUIhghW3Kau2Kq6LdEjomU47zHHcvqkQu6egTxVBm0kwxMTNmqGkWSfALi6TjAwyfO9N7P+mj+FdRLJ5LcxQP1jiIsnY8LzW+lV3AF8H/zrge3tTfCJUVJxAI4Fv397ilSdFxBF43UGQUIV55dQokqfwLmUWZj3MOgHGObTZQMThimVoNZE4BukyVKlTaUFP7q8uLkKiWD/QqLvlIpuBA/Ze9wWaHvafL5x7vOv6yDPqTWi0ZqdQmQDvka5WJxdQEaRQQZPW5EKqmd315PKhYskHs3mvNu+EVAsPjkHsJr4ZwYTXBHiqxt14iQSJoFVn47c+DnFhUgGdd/LLKSw9FG3Wn4oWN2uSC5ykm07nv8S1bey8zas+dMYuLaeJSe7cEOCJzdZkdAhJGiw49y/RxigT2XtSrKCtpqmLJ/UHicA30PpwKqguagsuIHEVClVojqJJDSn0Mql9bgI8N3DVfqQ6L9XCEzUIP2fz32XHv88TWJ/tj/+U83QFj+y28Gp9C65nGfFhryDa5ySkZ1m6v7YJv+EOWo/fgF99O4Vnvpb4qFdR/8k70NF1EBWfEvfGBHim4pP2tvdOCpK87f3B8P3u8HkesDKdKTTun27I/X0jS8K/rwjZLtu3DtN+Rf4UrfTbc7VrCGLKwjtI4Zg3UDrlQ0jvfl2LFRvbaN72KaQyn/iQc2n87G9QXcMsSmk2Ad7jUiHgdtYSFRTdYahkT3E5ODhju2lwLDfqytBil3cImkzgR6/IiemkPmvYsgSpGhRev/SZxRsK1dKG5lh/lBTmJ04XCW4J+KU4V11E86cbNlLozDipNachvEe9ivI5Xxj/WOuD0NgGUQmpLkGKfRRf8D5I6ulm7owJ8M5UWr2ljLWSCfv4LIpacEI5dkROSPagJB8Dbjm04MZJM7Iu5KTC4UubxYGxzaVy0ZVKEWWaVHBUErTakKjaQHvqSM+IuJ5hjXpHRHqGcb3D0LMN17sN1zOKVEdxPTWkWkcq+0LFQ1majfJidT2lyBdLAhUSKigxnsedY15PsqVXW3iVmBC8OnKp24mMCWgLKc2jdMrfpmawJujIWur/8x6StbegrVHEFZF5B1M46lUUjnsjRCXwTWugJsCTa956SzliYZkTl1VRwHWJZieqDNYSHtta58HNdbaMtegvReOCqLtahfM4L1rBisaVCw48OoriVyosRbXHIb2gPQpVFaoJVLwOlrclUtlcqpRqUKp5KYzFUaGGY0yE9NNRR6jjaAI+m1OnSgwUUUooS/BUNKGKUsVTUaWMp6RKQb0WUY3BOxSnMBhF0dXSP7/QUkQVjxA5eMupjmYyiXErgjZGifc7Fek/IHVhXEz9fy6jsfJaXHUg1cQ6gh9dR/LoT0hW/ZzyOZ+f8z6vCfC4hrRj4MqJMNpMOOPAPi49ddlOT5F45YHNda67axPX3LkJEYid7Go7E0GTFaxI/nrhoWeOuOg76qKeUWAUxyjCMMIIwqgIoyrUEBoILbJMbyVGKaBaUtUKqlVtMh/VHg2CiVIOQlskFeJ0EEe3V8MDPkQGPIKCeETq4EBIBBao5wRX05WDRWnVZXtK5M4TNNKhIKksCgKZDoGrb6Y/SaGaalr1SFSE0jyad32F+OjXEB90jgmxCTCgmg4fdWhX75W+kuM/7h3khw8N8erjFvL6Zy0kUYgEoo7E3cgJRy4q8zdn7sfpB/XzF//1CIlPy06vmQlAU1xxwdJ9nv2pr7Uab4qdVOrqmw4kaEopq1JBqWoi81Gq6qmi0pMTygJIjErUIUdZPD39FHwQzvp251nG16azdrnPCGgC8/CyrhlRTxyuoKhO0UUVh9a3hnHfNGu6dOrfodueIFl7M7hCOlzkghMTxySP/AA3cCia1MwPnrsCLKhPkHIvPc88C03Gj/EqEIuwpdbi7g1NXnRwP5ET1CuRE5b/ZBX3baoxvxJz5MIyrzx+AUt6CjQS5YyD+njvafvy3h8+zkAlnpZPHJrplkp1wVmiwot0dPOAZ99IfVxCpZgKJnEQHofgRBARWihj6rcLpQKNIGraRQgnEsrpioQCVVFqiVBLoFpMc593eh71SFwl2XgnOrYRKS8A9bj5h1N91f/Quvc6mr/7BsnqX6KjG5BCFSkvoLnyaporr06v7Irbx4nnMnNzNFw9UqpQOuLkEBSRHRpm7ITeoqMYjT/26zUj/OihIb57/yB/99PVvPK6B1g33KTghESVVxwzn4MGStRaflpKIghaf7Mx8tDatTeffZRvbNgXL/uI6AIXUXGpTh0WYa0q9/kmtzbHuL62lVsbo6i47WY0uWiy6xJh3lNTcVVTAW60hLGWI5KpzrdWiAroyFoaN/9dyMBy6W/hCsRHv5bKH/8n1Vf/nNJpV+AGDkPHNoFa8rRp4E4TeoIEDiXVJp3uVk/B0V+K6Ck65ldi7ttU44aHh3jl8QvxHsqx48CBEo8NNShFMi0zOpZoQaOx7VaAbeKkDPx0bIuubtUZ8i1GfUJDPUnwdosiFMVxbKmX4+ih9RSPiXqEinhaTWFb07GPTGPGtU+Q8nwav/0MxFVKJ/9NGmUGSBoggltwJMXnvZfiiX9Fc+XV1H/5oXR4KS6b9rUgFruUjicIIqkiaHolURgoj3+M9ZbfJdMm0WQsdvGylm9JDMMe+OHIRo4s9XJsqZceieh3Eb0upuocZXEUQ4y8rv4pnX+YzestiZI0hS1jUaqBp1MLVaTYR+OWK0ke/QGFZ15EfOi5SHVp7qHUIa5QOOFiov1OYexbf4SObbQsLBPgXWNrvcXG0Rb1JEKA1xy/kDMP6aeZKIVIeHSwzsoNY5QLbtrtS6HhongxvqUeHekRx0BU4OTKAM8u9jLskyDoig8JJPWwcMfTYVgqUARcomwadTiXTZifug7HK1JZiN+4ktr1F+Ju2p9ov9OIDzmX6KAXI+X56ZWSJm7R8ZTO+gxj3345EpWwJZ5NgKelcQAues4S/ujIJgOViKMWVThhn+r2MhtHWrz7+48z1vL0FCL89DWEdxIvTpu2DhfFURSnq5s1jogrjGhC1BEpfjo9wjTgp8QeNo5E2UL1UxQsTWPrUZxq2UIVKfaitUGa936D5u+uxfUfSOGEiyk+553gYtCE+OA/IFp6En79b6DQM+dNaRPgafJHR80f973plXrLc+0dm/iHm9Yx3EwYKMc0vU5LuEKzb4mLFoHDKUMRQq+L2OYTIhGczrxlOiKg5JUNIxGITk0nuhgd20jptCspHP0aRq89Ba1tgagALkZK89MR8domaj++DJrDFF+4PPWNowi38FiSNTcjxb45L8A2J2uaNFpKreW3DxEVnFCKHb93yDze8cJ92Ke3wGjTE+2apCVOol6cQ2BIBPpczJBv7Yab73BR1HUTt3s/f2YtV/CpAE/L//VIeT7Sux9SWRwizGE9A03AtyAq4XoGaN73byFbKz0uUdHMZ9PA02+sAO/43qPctX6M+ZWYffsKvPTwAc49coBDF5Q4dMFiTjugj9d/80GG6glxNO2MrEQkgkuaJff1Q4ZQGHAxDzfHdnmJytrWIXySjBPWdEVbxUURxb7e3Q4G9YiycThKreIpC5ZAqwbqKRz7Bmo/eBviiuAK45/72CDRM04D58KsMcGPrE2F3YJYJsDTZfVwkwe31OkZbnD7Wvi3u7fwzpOX8p7T9qXW8hyxqMxfPn8p7/vRE8yPY5LpNbJExMEvLlpQwA8q0O9iRn1CgiLT0HAiQqvR4H99ZDmLjziMZq2WCo2AJglRocC6e+7lRx/+KIVqGd3FiRiq0CuezaPR1JYY6zClEUfhhIvRxjYav/1MOt7r0/FeicvEB51F6cxPbI+OaW0Qv+5XSKFqQ0kmwNOnGAmVWKgUHJWC0FN0XHvXZi44cTGLewp4hZP376WvGO3K7CQVEdiyblFBdMij9LuYMfXU1XddpnVn0rXkmCPY71nPpLpwx1cWJc0m6j27Oq82G0rqFWX1aESz5aaZZxEG2l2B4vPfR+G4C/CbVqK1zeCKuHkH4RafsN3kxkU0fvUR/LZVSGVBqpF30rnM8vdvmgDvKdM6aylOoBg5Yie0VKcrdB6EqDWypJDoUBIp/VEMAg1VKiFVUqYku0pULHLNK9+Ees/FN/wnS489GrwyumULX/rDV7Hh3gco9lSDEO8aHuhxnm1jBUabQiHWqaVTohBX0nu77R8pHH8B0rMPUc8+E5Zv3HIljds+gZQHpiS85QIkPp1cYQI8FyN8XVphvaWMNn3a8BKl0VIuPWUZi3timokSO2HVUINtjYTeotuFyf5Cwbf2KUduyxDKQhdzQf9+FKchvJ1BLO/99sAVEQw+9gRr7rybcl8fupt+pGrqA4/VhOGGY1Ghhfey84qKoLUt6NhGGr/4AK27vkh89GuJ9jsF17sfREU0qaMja/FrbqF577+SrLkFKc3bqe+rCsUCrFwDA1VY2jd7Q14mwJM0gpGm32Es9+D5JUabnvnliP36i7z08Hmcfeg8Wl63Z2hdc8emoIUmME07V13ssEsL+H0qJI8PAoLIYlfYrTTJHaLNIhTKe+ZtFVk6ZaMhDNUdS/vSZWUnlV/fQkoDNH71EZq3fhKiIn7wfuo/fU+6gF1xHuJi1DegsS2d3B+V06SOKaxI6RVKJeE7d7Z4/kHCQQsjxhpqAjyXzOLYwYn7VHnRwf20fDpNruWVj754f2DHaYVx+P5Pt6znv+4bpL8UdQ9gqSJxIbzro9H1eKR+mVfGVBUBaaK758p1qYfugdVDtqdTulw6pZuq45lGoZWxNKIcV9Ppg5pAaxTNBqniMpIlbExnOVmFglPKBcH72RutNgHuIHLC5rEWbz1pCe87Y98p/U+9pfx27QhfvG0D339wiL6i656FpYoUK9QfX4kf3kzlmNMhGbdEjCiKaLJUE21olPeuZ25nNy6dUqYRPJIoF8zy7aiyROM7H23tUsWaHuJgfYgJ8FwxnZVyLNy+bpTP3LKOJMwD7gxaeYXhRsLqoSb3ba7x0OYaLQ/9pclSKBUpFGltXk2yeTXVE85GW+O0cJQkTYrKwg0iPpxnRifbKFDYIZ1y+iHAqe2fpnnvIXIe1b3+hRcmwFP+0TWdEnjb2lF+/vjwTtujc1CKHOWCwyGTj/tq0CgiUKx2M22jxDe3CX7exkJBenXvGAhxdKZTzoDlXjVd7qgQud0O1JkA74UBrHIsVAvxlBqKJ/WRkyk1WkFbTVzUVbHG3ifrBCpPJMXiMdIaU5GqzrwXG4/rkwSo4tkwHD+l1ZxstZG0MxYi8SimgeekECdPRs8tIN7jJerWGGPvWxtBq6vEVY+FMZCq7gWNryrKxhE3zXTK3XiMAkWXWxxbcy5zmiuKqhKbBjb2nMZIG1KSNImiuJtWiNUnWxxSGiLqczCSCAtVZ3gga3fSKXdReOstWDOSzsF2ko6/Ry51aQRIVBhrpcd0FqdjmQA/KS3adzV6RdPUQacJ6rqOwzqvrW0CA0Mumu+8jngEmcFJgbufTjn9zqIYwePbhC/9oplqXMJQkQiqHpEIwbN5WFnQE9MKq4SaABtTatKu0j/+NZmaGnqatHClHlQiXBR3c8siYAxhWwNZGMHw3vAiTQ/0ZumULaEQTTWdcte0byOBA+Yrf/fyIt7rdgH2mgYRvYfERxTjtLz3EMczOJBgAjyD9JFvMXr7D/E+wcUFVBwuKqDO4cTh+hbSWPMAlUOelZrQ29XV9lccNURlc0NY7ISRvaHB+bA65VhN2FZ3LKq2SKaSTrkbtBSaNd3+7CS84k2AyKWbalq3NCKdJud4QRlzagJsdLcnAT82RKs2gqhHkwT1LUQ9PklwKEQxhX2P2P7ScBHJrwabiMiGxLMIdFTGxbimj4siNAR08mosm9Cvye7peA1iU3GeekMYawqVkuKe7lcq555o4qHSl7DywR5qDWl9/13rm+d8LE0fERPgGSdEmVv29ERzXEzvyX+ChBeVSAhebR8ZVUVE8LURtNVA4mJqbbYFTCORtV7ciXhqsjtSIMLY4FbECYVKpa0xWy1GNm+m1NNLoae6yxPjHUJRoKlKWRRtwd3rSlRjZaThZswSzpFT7vpdD3++Yil/cfoWXvzBh4SPMSts6lkjwEuOPTOVD1f8tTjnRByqPtGnfN0GJRkZnIJwOURIonJvKamP/k5bTSQqxJo0vRNZC7rAi1snu9rORNAk4fCzzuDoPzyH+Qfuj28lSOSoLpjPc9/4WkY3bubhn92EKxSm/ZQcwjZN2Jw0OTAqE6lSccrbv7lYK05nzFT77Pm1EvTdZ23hbadtbq6/evEIbDATeiax4nxJuPxyd/eFh33n2I/ffLUrVl4fVfqiuGce3kW7tAb0k27jiYtbteEnpD72jpyIukijNYr0N5XV0S6+eFyAVrPJy/7h71l46MHjji067BDO/+JVrLrtdq469SWUi8VpjZV6oCLCnc0a149u4l0DB1JyHpcIf/WirfL6k4ZkaMw9/ZFfaRtGS3oTqss8W5+Qry5924ZhvY5IhMQEeCaxfLmyfLmuhD8TF/3B6KN3Xx0vO2JNUh9GJJ45gQuHRi7GO7e1tu7e7z60/E/Wc/nlTpcvbwI95bh3jTa39dRBq7tszStRocA33nAxpb4+xDkyc1zVo16pDW6lWKnsUqKDAk4V5xWvihPVauQZaTC0aKA21BPHEkczI4MixBjGBlfJvw+UtnxA09WJZsV6PLPNB05f56uqKrL58a+87wm+8r5PzXy/XWD5cg+cBXyuv9izQWtSHBOJe3bntM6x5o67UZ8wftmc9G8XxcSV8rTN5+1vKBRJ00gFfJNa5HztozfM+9rrjmxd9uW7e+IzjxmZEWthHAR8mUcby5cHob1o9jT42RiFFtIe9zJx0X+KK1SjYul6tmfdyQwaQlBpNkc9zWYFuBSYB3xuS+2BPnB+VF1R07WWdzkeVOyptmU3P2IV9u3qcjoaBDhXM1dS3dpMZMHByx+tgcryGfWsQa8j4ny8zKLE6NkowAnpBJnvqE9eoT65wrdq72TmxhuzdN7fAi8EtvUOb3VSmN8YwVV3aS5s/uT+ybMURQkJFAoiURkdihyLFOR8znfXMbPMVDl/7/d554IAZ3EWB/x72OYxswcMGsBo1s5+veWhof6lJ42NONcTsihnZN0jkdR8To3wuEf8kCgDaQ7Filml6UyAnx4hjsLn1r2gvi73h+9VhsZgQa4zeppMA+26P0FxwYRWQUVFqqrbVHT/0w88sHzjo4/WYCZMDDYB3tvNadg7huuDuXlepKwAYfOol4NEtSUixadDeCviUj+3S0VL4ugRh3qP94o4R4/3o+KkuGmsbx5QM/EyAd6T7XEvYb0EIVlfF9ePin86HlZBhJ/Xt/JEq46q0vQedemkgZZ6nHNsS5qMaRImAAs9ojVAtrnCAmCdaWAT4DmLiKxrqPQpT1/gpaVpgCpGiMQRu3TROqcQR45nxCVOqQxQTCXYV1UTlFYiLAbusV/RBHjOknhd2xJX1KfWFN0+JaqpyhnlAc2Z0DquXJq4SoIypj6JxZWq0rpJ0aNEWRbcAYEV9mM+FYETY6awJBOUtS0RWkJBdhyOyVaR0bBels9tiYYtXY+1+xY0e0I64y4TXJGQpR0j0lB1Y967mveurj5qqI8aqlFTNW6hcQtiFRf3uUJpq2/d/L4ND/1zWbTSgJ68O2CYBp5zVIWhjZ71TaTeI27/EU1fWJJtae+bTr2S8NpCyb7TjtqlB2Sc6GeR5VTyNZV8VRS8qjYRbSjSAOqqWhNkjHSYawT8cARD6QvIGayIDBZF7710w4PfumrZSUcVvB7fdPKL9GI32usDTYDnGisUoOyTzWMSjW0iuqisyT8UxR2paCZoLVWaIlpHqaPUVLQm6WsORkFHvciooCOCjKjqiIZPQUYSdFRURnykIxHRcIIfKTg/PEAyvMQ1hl8TRSPFJ54YS5gsE0NgwTn9REOL0WTZ4qXzLo2UDyh8YtOaW38H50WwIrHf80mOldgjmJG/iS5adNKyyPmV66R81DsKj2/rb5RPQMRDMoqXGonUGkXqvu4bW8rzm7euoXkrtzZ368rHnFdk/UMLqxItKdFcFrloX6e6n4juK7AMWILqAoR+kDKoQ2khjChuvap+bv362z4bXDPTvibAc1eAjznmmOLGjaU1BfF/smrd7Tfsykk+wBnximds6G/UK/Oboos9fmmCLFNhmcIykKXAYtAFIL2qWg4rEbRAxxC2isomj64Ht1aE1SLJmiSJ1kKyLkl0Y6Ggg+vW3THSWX/7GU2A5zCp+blkyYmfF5GTS7XGqY9tvXMLwOXgvjr/pL6k2JpfF1msGi1RZZmDZSosA78PsFhVFgB9QDloxAQYE9EhVdlEWyjXiLA6SVgLybpSqbyx2RztFMqp4ELU2cxmE2D7XQBZuvSZFSj+O+iJ4O9XlT7QfpASaASSF8rNIOtB14rIahHWJAlrwK0vFmVjq1XbsutC2RlNXqLBV2+vKmeYABs7mtIAS5Y852zgOOd0S5LoWkjWFYuljY3G8OCGDXcPm1CaABsz+/dRE0rDBHiv9okz4dwulJhgGoZhGIZhGIZhGIZhGIZhGIbx5GHDSFN7JroHy+/s2lkChz7N9/9U1kOm+fzyzwlsGM2YQoOJp9HhRUxvsYSoy7mzaz6V9xh12e8m2P9k0+15uwme63R+G9PAc+CZlHJC2ADqHcfzPX4xlM2WsB2dpCwTCEg29a4fqAIjwLan8RksCvezreN+niyKQQi3T7ro8gzzz6k3bHVgizVZI+vVDyRdjG1DaEhKuibVXcD7Q6Mhp5E+BzwcGpwCLeBR4Cpg/1CmED6Xh/Mc2kWbvBz4ee6aCXALcAnpovTZ9d4UznFyRz2yz7eH48cGobgHeCzU6RHgTuDesO+h8Hlprp7vCeUy03kMuAF4QxCwX4b/eSSc887cNbLzfSSc7/8LdXkQeDxsj4XPu4CFodwV4Xwj4ZoN4D7gw6TrYufv7zTgh0AzV8cHgU8A+zF+MZI5ga3IMZ4ScBRwP/CpIJADwDmhQb0EeDHtheaOIX131mdIF48vAy8A/hw4l/RVKWtD2YODYFVyjbIJXA58EBgGvhjK7x/+/9PAd4Ch8D/7hnPMm8CSekY43hsa96Phej7se07QWHfQXjB+MPzvPwMXAL8BrgmCdATwinD9rwKrgtbz4V5PDhr6V7nzbQrnOzTU5YbQEeTf0LSN9mqbh4SO88vAGtL1tF4YOsw/Ac4O+08FfhLO8eXQGSwCfg/4q/B7ZZrafOI5qoEPCQ3rC13KfCE0jPNz+34ShLCTD4SyH8rt+1w49zG5fX8Qyv0CWNJxjmroDPId7XvCOc7u0ExxTpsluf/Ls0849rkuxw4M9fheFw02P6ct85TD+f5rgmf61XB80SR+P8CXQrnO+39XqNNV4ft/hu/P7nKug+Z6wzXamswFLVAOWqsvHPtGaGj7dim/NGjvnmCKfiFo78O6lM1HeT8cOoDXA+tzvmAcNNtNHQKVnSOeYOsMnhVDfaKgtV24ryjUtxDOOT+UfywISSGUKwSNvSnXXrLrDITvWbygmPvMuwiLQ5lK+Cx1BJ2ye1oU9pfCvk8Gq+asUG5BeFa/y3UgWdlH5mo8xwS4O6PBTB7OBZPeGhrojV3Kbwqm5UhoZGeGxnjbJIHDQ4JJ++Pgx8XBbG2FbbIg2JZQph4+a+Gzc8J+ktuyAJDm9mXXeSjcw58BF4f7rIV7iXPtxO/kfN3WwVsX6jkWPuu5607WLjMfNzvfz0KHcg1weKhfPWeBzEmz2Xzg7sJ1fPBj46C5Xhz2vS74iHFohJlPd3YQ9J4gvO8NDe6zubKdneZROfNZJjEztUv9LgBOpx2ZjYLwnDnNjjnzGYeAC4Nw/BNwWTCBvxI6l93Rbn8fno2EumbadXVHuc0dndeFQcv/S/j+UeAU4I9D0G9F8IW/G/7H1uIyH5gjQiPTnDbJNMFa4GUdHd8Pc8fz25/Tjj5nn58Px54Zvr8hfL8kZxIC/E0ILK0njXB/IydAfz3B9Tq303IdQHZvh4djX+nSeWdljg71zKLqtRBkk1yZrC5LQpnrJ/DHr8mdIxPMZvg8MXftL4dyHwjP5C+Ab4d9twXzXnLP8hLSyHd2rz/KuSpurjZco21yCnBd0LwLQ/DnHNKhpW8Dr85piUxDvhx4S868PmkCDZonGwqp5LQTwM2kUe1/IY1GH5Y7Rxa5fTVpxPnAjs9Ph+PTfSt4FkG+B3hzuOZlQZA/GITYs2sJHSeFOMI80nHuPtKXmXdaf8uBq0mjyc8DrgReRHucV8Izuyp0gi8J7sfvAT8IPrJiuQ1zWgMfGhrBV7uUOTD4XL/O7bsxCFW+MWaa530dmjXTwMeH76eG71dP4s6sCQKd8X/C/5w5wX18OBx/wTQ1cJaFFXUI6XG5IFa141lNVQMftBP3LdPALwpxgf0mcGuyunU+p2vD/79+LrqFpoEnblwF2pHTmHRMtcaOY7CEfVnDuSQ0+kuD+dfoou0gTYLYQjreOxC0ZpF2dDj7fbr9RsWwvxA+s++72njzgSihHYW+izSpYgHb33c0bQ2XRdbzEfZumvzhEExblfsNpMP6yBJdYtpJNdnowNK5rHmMdkPO0iGbtCOnrWAi9wM/7TC5s8hsKzT8waBtB4JW8DnB9bkGuTWYvAuCuVyhnbbZBF4ZOoDRLvXb2aaTmMra5fc/hjT6LDlftRb2HxMCWVu6BIo8E7+BITuWRczzEfYkd56sXDnXCUkuSJjx9hCjyJ51thrnq0KHcGfuGc0pTWOMfx6OdOzx46HR9QST9DlBG11OO/pbZfyYZhZlvQp4B2kix9eBjUFA8xo1Dn7e6aTJIc8D/iNc8yzSLCaX0zRMQdNmx7tpuCwQVe4QYE+aNHEB8O4QFNoUXIZXhTJ/FoQmyglsdr7qBHXJ7vffQmeQj0IPk6aFbsmVy8cBNGc2J8GP/mTY/gO4O9zH74fn9J1Qb8fT+D5lE+CnnxqwkjT54C9Dg6gF0+6DQWNuygnIymDytjqCQY8G325pzhx+iDSFcTTXSEeBl5JGl/838LZwrh8BrwnXzAvjqnCOwY6Gnn0+Ho4Pd9FGtXDs/g5tLiGA9GgQ2LeEffUQJPpI8HNdzsTOgnB3BGHqVpf7w/F9aCd3ZEGmrbnzPBjKjU0SVLyHdPjowhC0elnumb6fdIipNRcDWBaxm1iT5WcjNTue2VTnq/oplNNcZ5qZzCNP4733h05pJNfZzKSXlZVCHVvYTKRZLcCuI2iU3zfRRHU3wbH8dEHfxdebaBaMy2k6Zfx4aqewNyeITcgEfu1UJv93ewbdYh8up2GTLvv9Tp6ZdLgRfpL6COMzrKZS3+w3EHYcIos7fOrJzmFYx/akEdF9Yv9MvYeJFgCAiaPnpnzsIUyZw0KAZWVOqxwWglJrSDOd8iaskI57jga/bClpgn0+oOIYn0KZkM6vrYZzJx1aKiu3Oph7VdKobl8I3kSkaYwP0B4+yepUBI4M17yP9hTG7LxV0rHdVSFI1s20PzKYnCs7NOsh4fraIYj5HOzh4BfvG2IC9+dM6vy1FpLOEFoW/ufOcD/dTO/DQ71XkybGSIfmPI407fLhLr+NhrosCse7+flxCGptC/6xpVfuxabzzaHR5sdtfxV+0N/QHkPNypeDkPwsfP80U0tbjGknZUy0vS2c88xJylwbhCG/uEAtHPvHDi0N6ZxZJR1eyRpv/v4Py/3/Kxi/RM/DU7ivX4ayHw/fX5i7Tib0H6Kddpnfvh06iU5z/fZw/OZch5gd7wvHvpu717yiKYRgl5JO4O92z0vD8R90OcesZDZHoT07Dilk2uBZpHm3XwgNI9uf5HzRrwfNlfXibwSeSzqMtCHnt+b9028D3+zwy4R2NlWWPvkN0iGRbBrdm0kjwAPA/+pyLxeRphg+0MXn0y4dmA/nLIWyl4R6ZWUvC1rVh/u/kjSy/be5Oq/KPZPO6whpptUrg6B/PNRtgHTs+wLSfOfTSaf6uY7n9Lxwv9d0ef6+i2vhSYfWjg8dxutII/RbJ7Aizf+dBRr4l6QR5LwG/m0QvjWkQy6VDg08QjqE040vhgbYbXL7KeHYX++kbs8P5f62y7Ebw7HDw/eDgkl7V2iQ14X92ZDMyR3aPc4Fk0rBZP8GaZKIZ/KE/01BO3bjI+E6J+f2vTnsWzGBAF0cjv+4I3B3D+n0wvXBxC12aOAW7QUCOpcLuj50BpewY+pkpwb+3lzRwHMtE6sMPEE68+UZoaF5dpw0T9AMcfif7DPz+bLUwFLH+asd/5Pf8ufOUjSrtBMh7sldN9NGUWjQVwPnBQ3U3EkgjKDFB4KW/0y47gW53zzK3V8P4xcJyPaXJoiXFEhzskdIZw4p4xNICqTL81xPmt98ck4jVoIQfpB0iaE37URbZpHxZ5BO2fx6OHeNdJx+zmvbuSbALdKx1i+FQNX7Q0PvFtDztFP/8ml9Scf+PNl0udoE/5sxTJooMRq2o4JZ+ECoV95kjXOa/f/uJCiTmanvDpruVyGo9EjQmuWcmdp5D9qxL5lAgA8nnfRxQ7hGFCwd3+E2fDb8/ZKO5z9AuqzP48Ed6WXyYTiCoEN7mZ4VwZ05nnbyjAnwHKEYGtJ7SPOQs7WXdsfcyjTs20KA6JEgjI+EQE/S8bxfGvzGjwJfI12R8rEQbKp3CPC8ELW9JgjDaXQfwsn8zCOC1vtiznz9fPB5/2A3TMus7geEut0+geBlncjd4dgRHcdLoaN7XzB53z7B88+i/AXS+dW3kkbjY9rrel04QedrAjzLtbCEoM5vgHeGQFJtDzyPDSHwlW13BeGTjud9Ammu9LuA14Yg13FBW8ZdBEKCtdAgXa5VJwheERp7nXQljEybfiKYvG9j4iSK6XZWzZ2Ua3S4BJ3P/9rwjN4TtPJYhyBmc6lfTDp18b056+enQaDfkPOdTYDnCPno7buDD/p+2sn6u9opQDrX9tzgg/5R+Pufc885K/cp0nTAM4Ip+hLSFSW7kZmljwD/EAJhp5AuQdMpML2hUW8ijfJeHLbXBnP3TNqrjrhdfG7Z+PmhE3QkmVbO5guv7nKebPripUEAL+vSgWadzF+Gv48jjcZfEj7XhGf4x9hY76zslLpFoe8iTU7Il/tRKHcUaULEDR1mZucE9UM7gkHQjkJfQXsubX7ua1buBaHc/+0IfGVLxDwrp4X2C/v+KVefBaSJH78kHabJjwMT/GjNCX1+a3Vcu5AzabeEZ5M3R7P7zqLQ2Thwfyi/lvFvsMi7KNBeWje/DO/9tCdTZM/k50H7HhliA9/NlT88WBOTjVf/Ilc+H4XOxr0dO64Iahp4FvHu0Jiv2AOmWH4ubT4Y5CfQUj0hiJUFqd47iTYpBK3796EjeHMXf/ZtpGOjx5MOQx2c244LQve/Qwcz3XvN6jUUgoBLw7NLGJ8P3gj+9iXBpfjeTgTnXaE+Hw7Cmi/7xtAhnBvu59Dc56Gk0whfEFySfHv2uU7LMz4f3dhLOqWfBeHIa+DbaUd5843/uvDjNoH/nkADfyUcP6SLBn5hOPb3wSScHz6zLRuCen4od2VOKLMVNbJ0ySzosz/tNaDyZXuCFZFN/H9Hzq/2wcyeiCvCfb4s15GUgqDdPoEGvjJcJ79MzyLScVwNPmx+zvKJpOPtSjr0lX+W99AeLsvv/3bu+X8z7CuHDufOSe7n7PB/n8xZLQ3SIawlpOmdS3Jbj4nH3iPAK8OPO5A79njQUPkGJMFUy3ron00gwFkjO6KLAJ89gXmXma0XhXJnhu+fzp07O/9F4dhnw/eD2XENq6zsm3PXeH/Y99XwPVsIIDMf838fwfilbCUIioZn002As5TS0zpM7yNJV43M3qG0MpwjE8QLu1gIG8LW+fyPzd3PTzrcgYtCmWLufrJnXwy+vYZOZJ+dmNtXdtzbXs9sz1S5nTQbKG8u/jInpNmY5aagUe4nzaP9Ld3fP/sg6VKyY11My1oQjJvD50257z8mTSDJgk0/zPmCmXmdJfB/KWierG4/pP02gsxUvZP2Ans/IB2C2kQ6dPXNDpMx/3f2hoV/DdfP398N7PgmiOz4qqDVttJeS3pjqOt9YV85lPsK6aIA2QoZne7Dz3N+a3aP68M93At8nzTneSQI57XBN/YdwphNLdwQ/uc22tMhs2f/y/D5s/D3j9lxnN2YBcgcuZc9eZ87i59Ec/T5W8Pdg9ZF5wTwiSaF549lUdyJjid0HzqZrMH63Dk6J/nnJ/tHue/ZEqr5CfL5TKdSTqP7nGnZypmJ3e4l7mJdFMJnfQJBzVIaHTtOAZRcHTtXInEdzyvOBft29vyz55HsRFt2/qbxTn4Hm+hg7HFttatlnwy3SSbY53ZSZ9OipoFnrfB60jHe80iHcyT43D8mzSoaZPxb6CukaZVnkQ7JbAq+3H8FP9ORDtPUc0GvPAXSBIjNpIvrddblQNJ37z6fdBz6YdLo+/dy7aKb1nsuaYLKceH7HcC/k2a0dV7jdNLo/NeC/2+T6429VvP+FePfsbQu9z1L1MgSIE6kndiRhLLZpPk3hDKlYDpvmKBD7qH99vpOE/+ttJMjBkkzpbK6XE869JLXqtkC8v+UK5dNCcy+/2POPcii1NlCAC/aBZ/YMGaM8GavNPkN6dBLxj6k0/FekBOwZ9COQL+V9hBYD+lyqgM5P28V48dU8wJcDcL5qw6/MHuh2v1BsLJOY1/SsdTshWLZFMNM6LKXm3+bNGMtu9bxtF/w9pmOjuhDpMNJp5oAG3sjmdD8adCkbwzfy11cl6xxfzkIw+um4MeuC4LYOTaaLQY/TPv9xEKahrmFdPhn/wnO+4+MH1uG9tj1jyf4nyJwC+PHiqG9usdpJsDG3kjWYLP1sr7P+KSSbPJ8Vm4h6VjyXbnj+SVb8znHmQDfN0nnkRdgSN+ukL3GMzPD8y8Oc6F+W4N2r4RjXw//d0rOv6ZD2/5+KHONCfDTY+YZe55s2OVm0qSGFweBemcIImV509lvcGwQqu8zfo3l/OydzhUvC8EUz7Zl4XP/LkGj08P3/2bHdw9lwzaDpAkd+9J+q+CpYf+v2XEIrhn2ZYG403JCbQFSE+C9niyt8I+DeXoA8LFg+n42+LzZvNpsJs0qdh6tdSGwdRDptLpsWx0+Hwp+cH7O7jLaWU+TTQPMMqsW5ur1ODsuNJD/u0aan72ENPfbeIr9NOPJE2AhXaf47aQTDV5Nmmr4FtJ5wOfQXr0i+01kCufNZid9LFc+07rZMjx5s7U1xd88ymnl7P9KXYS32/91vtnBMPZ6hB3fGNhLOqlfgW91mLhfnETQ8j7reto50t3Y1uEDfyKY5C+m+xsOs/p9P9Tj4PD9rqB9F7DjGxfy0yK3kUbFs+NXmA9sJvRs0cJZmmG22uMw6TTAIdJxX2gn8L80mL+ediCr22tXMk2b37IVJfu7aPHv0l6d0jM+ap2tzbwo+LwrSScXEHzmYnADsnWkM0Eu0h7r7Q3X6PaK0Jjuq3QaxozWvASfcEGX4wtpv4ok4yrGz2+dzFzNhpG6XbPK+Ch0JqS/Ded/+QTnvTocf03ufIcEH3cN7bnQeQaC5m2Qrj2d1SGLQj/LmoKxN5JpzP8XzN23As8kTew4hzQ1UklTIrPy2TuIsrc3nB7KP480CPbWULYYBOreSQR4iHTht7w5/izaUwL/lnQRgENI5zP/N+PnH+fN/reEYxtJ5yIfEYT1VaTZXvk5z6WcACeka0C/hnRs+zVhO5/xLxo3jBnr+76H8amT+Tm6V+TKZe7MQcEU7TYh/VM5Ad5KexJ+NwFuBVM4XxeCyf6LLudOSLOnsrpIh+/6atoT9vPb6nAsby7D+NUzu23LOups7IaZZzy59ALPIU2lzCa+38SOSf75CfDPDltf0OC/ov3WPwlaOSEdn+0W23gB6VBTt4kGkE5MeFYQ9seDUK+dJFaSTbI4hXY65e9oL0rncr6+ho5of7pPHUxCvZrWNIy9wZSezrEne2qe24N1ncoxwzTwrDGn8897Z5PLO4dsOstHTL5I+1SOT6c+3e5jstUedzaH2MaLDcMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMMwDMPYBf5/I9aCSjgeMaoAAAAASUVORK5CYII=";

const DEFAULT_SETTINGS = {
  curriculumFramework: "Inquiry Based Learning",
  grades: [...GRADES],
  assessmentLevels: [...ASSESS_LEVELS],
  branding: { primaryColor: "#801524", logoUrl: BRIGHTSTEPS_LOGO_DATA_URI, mission: "", slogan: "" },
  languages: ["English", "French"],
  academicYear: { startDate: "", endDate: "" },
  terms: [
    { name: "Term 1", startDate: "", endDate: "" },
    { name: "Term 2", startDate: "", endDate: "" },
    { name: "Term 3", startDate: "", endDate: "" }
  ],
  reportCardTemplates: ["Standard Progress Report"],
  roles: ["Administrator", "Teacher", "Parent"]
};

const STORAGE_KEY = "brightsteps-hub-data";

const uid = () => Math.random().toString(36).slice(2, 10);

// Generates the next student ID number for the current year, e.g. 2026001, 2026002...
// Numbering restarts at 001 each new calendar year.
function nextStudentIdNumber(existingIdNumbers) {
  const year = new Date().getFullYear();
  const used = existingIdNumbers
    .filter((n) => n && n.startsWith(String(year)))
    .map((n) => parseInt(n.slice(String(year).length), 10))
    .filter((n) => !isNaN(n));
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${year}${String(next).padStart(3, "0")}`;
}

const EVENT_TYPES = ["Academic", "Holiday", "Staff", "Event", "Meeting"];
const EVENT_TYPE_COLOR = { Academic: "#2F6B7A", Holiday: "#B8842F", Staff: "#6E4E9E", Event: "#2F7A5C", Meeting: "#B5473B" };

const ADMISSION_STAGES = ["Inquiry", "Tour Scheduled", "Application Submitted", "Enrolled", "Declined"];
const ADMISSION_STAGE_COLOR = {
  "Inquiry": "#B8842F",
  "Tour Scheduled": "#2F6B7A",
  "Application Submitted": "#6E4E9E",
  "Enrolled": "#2F7A5C",
  "Declined": "#B5473B"
};
const ADMISSION_SOURCES = ["Real Estate Partner", "WhatsApp Referral", "Flyer", "Walk-in", "Website", "Other"];

const BEHAVIOR_TYPES = ["Positive", "Concern"];
const BEHAVIOR_CATEGORIES_POSITIVE = ["Kindness", "Leadership", "Responsibility", "Effort", "Collaboration", "Other"];
const BEHAVIOR_CATEGORIES_CONCERN = ["Disruption", "Conflict with a peer", "Not following instructions", "Safety concern", "Property damage", "Other"];

const LETTER_GRADES = ["A+", "A", "B+", "B", "C+", "C", "D"];
const LETTER_GRADE_MEANING = {
  "A+": "Outstanding",
  "A": "Excellent",
  "B+": "Very Good",
  "B": "Good",
  "C+": "Satisfactory",
  "C": "Developing",
  "D": "Needs improvement"
};
// Maps each letter grade to the school's official Learning Progress band.
const LEARNING_PROGRESS_BAND = {
  "A+": "Exceeding Expectations",
  "A": "Exceeding Expectations",
  "B+": "Meeting Expectations",
  "B": "Meeting Expectations",
  "C+": "Approaching Expectations",
  "C": "Approaching Expectations",
  "D": "Below Expectations"
};
const letterFromScore = (score) => {
  const n = Number(score);
  if (Number.isNaN(n)) return "";
  if (n >= 97) return "A+";
  if (n >= 90) return "A";
  if (n >= 87) return "B+";
  if (n >= 80) return "B";
  if (n >= 77) return "C+";
  if (n >= 70) return "C";
  return "D";
};
const LETTER_GRADE_COLOR = {
  "A+": "#2F7A5C", "A": "#2F7A5C",
  "B+": "#2F6B7A", "B": "#2F6B7A",
  "C+": "#B8842F", "C": "#B8842F",
  "D": "#B5473B"
};

const STAFF_ROLES = ["Administrator", "Teacher", "Learning Assistant", "Coordinator", "Support Staff", "Other"];

const RESOURCE_CATEGORIES = ["Policies", "Curriculum", "Staff Resources", "Professional Development", "Forms & Templates", "Parent Resources"];
// A parent should only ever browse by these, the rest are internal/staff categories.
const PARENT_RESOURCE_CATEGORIES = ["Policies", "Forms & Templates", "Parent Resources"];

const ACCRED_STATUSES = ["Not Started", "In Progress", "Met"];
const ACCRED_STATUS_COLOR = { "Not Started": "#8A9698", "In Progress": "#B8842F", "Met": "#2F7A5C" };

const DEFAULT_MILESTONES = [
  "Study the IB Standards and Practices",
  "Purchase and study the PYP starter pack",
  "Identify the programme coordinator",
  "Coordinator completes Category 1 Leading the Learning workshop",
  "Submit Application for candidacy",
  "Complete at least one academic year of trial implementation",
  "Submit Application for authorization",
  "Verification visit"
];

const emptyData = { students: [], classes: [], portfolio: [], plans: [], announcements: [], attendance: {}, assessments: [], rubrics: [], settings: DEFAULT_SETTINGS, events: [], admissions: [], assignments: [], reports: [], behaviorIncidents: [], gradeEntries: [], standards: [], staff: [], resources: [], accreditation: { milestones: [], checklist: [] } };

function syncGlobalsFromSettings(settings) {
  if (!settings) return;
  if (settings.grades && settings.grades.length) {
    GRADES.length = 0;
    GRADES.push(...settings.grades);
  }
  if (settings.assessmentLevels && settings.assessmentLevels.length) {
    ASSESS_LEVELS.length = 0;
    ASSESS_LEVELS.push(...settings.assessmentLevels);
  }
}

function todayStr() {
  // Use the LOCAL calendar date, not the UTC one. toISOString() converts to UTC
  // first, so anyone west of Greenwich saw yesterday's date late in the evening,
  // and anyone east of it saw tomorrow's date early in the morning.
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Returns the weekday name for right now, and re-renders the component when the
// day actually rolls over. Without this, a tab left open on a front-desk screen
// keeps showing whatever day it was when the page was first loaded.
function useTodayWeekday() {
  const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const [name, setName] = useState(() => NAMES[new Date().getDay()]);

  useEffect(() => {
    const tick = () => setName(NAMES[new Date().getDay()]);
    // Check on a short interval so it also catches the machine waking from sleep
    // or the clock being corrected, not just the stroke of midnight.
    const id = setInterval(tick, 60 * 1000);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, []);

  return name;
}

function formatCurrency(amount) {
  const n = Number(amount) || 0;
  return `${n.toLocaleString("en-US")} FCFA`;
}

// Compares what's actually owed (the fee schedule, set once per category)
// against what's been paid, category by category. This is the single source
// of truth both the admin Billing screen and the parent Dashboard read from,
// so a status like "Partially paid" always means the same thing everywhere.
function computeFeeBreakdown(data, studentId) {
  const schedule = (data.feeSchedule || []).filter((f) => f.studentId === studentId);
  const entries = (data.billing || []).filter((b) => b.studentId === studentId);

  const categories = {};
  schedule.forEach((f) => {
    if (!categories[f.category]) categories[f.category] = { listPrice: 0, discountAmount: 0, discountReason: "", waived: false, paid: 0 };
    // Older schedule entries only had amountDue, treat that as the list price for them.
    const listPrice = f.listPrice != null ? Number(f.listPrice || 0) : Number(f.amountDue || 0);
    categories[f.category].listPrice += listPrice;
    categories[f.category].discountAmount += Number(f.discountAmount || 0);
    if (f.discountReason) categories[f.category].discountReason = f.discountReason;
    if (f.waived) categories[f.category].waived = true;
  });
  entries.forEach((b) => {
    const cat = b.category || "Tuition";
    if (!categories[cat]) categories[cat] = { listPrice: 0, discountAmount: 0, discountReason: "", waived: false, paid: 0 };
    if (b.type === "charge") categories[cat].listPrice += Number(b.amount || 0);
    else categories[cat].paid += Number(b.amount || 0);
  });

  return Object.entries(categories)
    .map(([category, v]) => {
      const charged = v.waived ? 0 : Math.max(0, v.listPrice - v.discountAmount);
      const due = charged - v.paid;
      const status = v.waived
        ? "Waived"
        : v.listPrice === 0
        ? (v.paid > 0 ? "Payment received" : "No fee set")
        : due <= 0 ? "Paid in full"
        : v.paid > 0 ? "Partially paid"
        : "Not yet paid";
      return {
        category,
        listPrice: v.listPrice,
        discountAmount: v.discountAmount,
        discountReason: v.discountReason,
        waived: v.waived,
        charged, paid: v.paid, due,
        pct: charged > 0 ? Math.min(100, Math.round((v.paid / charged) * 100)) : (v.paid > 0 || v.waived ? 100 : 0),
        status
      };
    })
    .sort((a, b) => (a.category === "Registration" ? -1 : b.category === "Registration" ? 1 : 0));
}

function feeCategoryIcon(category) {
  if (category === "Registration") return UserPlus;
  if (category === "Tuition") return Wallet;
  return FileText;
}

// Human-readable names for each part of the school's data, used to describe
// what changed in the activity log without needing to know every field.
const ACTIVITY_AREA_LABELS = {
  students: "Students",
  billing: "Billing",
  feeSchedule: "Billing (fee schedule)",
  assessments: "Assessment",
  gradeEntries: "Gradebook",
  attendance: "Attendance",
  portfolio: "Portfolio",
  resources: "Resources",
  curriculumDocuments: "Curriculum",
  plans: "Curriculum (unit planning)",
  announcements: "Family Updates",
  events: "Calendar",
  classes: "Classes",
  staff: "Staff",
  admissions: "Admissions",
  behaviorIncidents: "Behavior",
  reports: "Reports",
  settings: "Settings",
  standards: "Standards library",
  rubrics: "Rubrics",
  checklist: "Accreditation",
  assignments: "Assignments"
};

// Counts messages the current person hasn't seen yet, across every student
// thread they're allowed to view. Parents only see messages from staff;
// staff only see messages from parents (staff-to-staff notes don't count).
// Counts a student's attendance days, optionally limited to a date range (a term).
// Pass no range to get the year-to-date total.
function attendanceCountsForRange(attendanceMap, studentId, startDate, endDate) {
  const counts = { present: 0, absent: 0, late: 0 };
  Object.entries(attendanceMap || {}).forEach(([date, day]) => {
    if (startDate && date < startDate) return;
    if (endDate && date > endDate) return;
    const status = day[studentId];
    if (status) counts[status] += 1;
  });
  return counts;
}

function getUnreadMessageCount(data, profile) {
  if (!profile?.id) return 0;
  const isParent = profile.role === "parent";
  const isStudent = profile.role === "student";
  const isSelfScoped = isParent || isStudent;
  const linkedIds = profile.student_ids || [];
  let count = 0;
  (data.students || []).forEach((s) => {
    if (isSelfScoped && !linkedIds.includes(s.id)) return;
    const lastRead = (s.lastRead && s.lastRead[profile.id]) || "1970-01-01T00:00:00.000Z";
    (s.messages || []).forEach((m) => {
      const messageIsFromFamily = m.role === "parent" || m.role === "student";
      const relevant = isSelfScoped ? !messageIsFromFamily : messageIsFromFamily;
      if (!relevant) return;
      const ts = m.createdAt || (m.date ? `${m.date}T00:00:00.000Z` : null);
      if (ts && ts > lastRead) count += 1;
    });
  });
  return count;
}

function useSchoolData() {
  const [data, setData] = useState(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, true);
        if (res && res.value) {
          const parsed = { ...emptyData, ...JSON.parse(res.value) };
          if (!parsed.settings) parsed.settings = DEFAULT_SETTINGS;
          if (!parsed.settings.branding) parsed.settings.branding = DEFAULT_SETTINGS.branding;
          if (!parsed.settings.branding.logoUrl) {
            parsed.settings = { ...parsed.settings, branding: { ...parsed.settings.branding, logoUrl: BRIGHTSTEPS_LOGO_DATA_URI } };
          }
          syncGlobalsFromSettings(parsed.settings);

          // Rename the old "Pre Nursery" grade name to the new "Pre-N" everywhere it is saved.
          let renamedGrade = false;
          if (parsed.settings && parsed.settings.grades && parsed.settings.grades.includes("Pre Nursery")) {
            parsed.settings = {
              ...parsed.settings,
              grades: parsed.settings.grades.map((g) => (g === "Pre Nursery" ? "Pre-N" : g))
            };
            renamedGrade = true;
          }
          parsed.students = (parsed.students || []).map((s) => {
            if (s.grade === "Pre Nursery") { renamedGrade = true; return { ...s, grade: "Pre-N" }; }
            return s;
          });
          if (renamedGrade) {
            syncGlobalsFromSettings(parsed.settings);
          }

          // Give every existing student a student ID number if they don't have one yet.
          let studentsChanged = false;
          const assignedSoFar = (parsed.students || []).map((s) => s.studentIdNumber).filter(Boolean);
          parsed.students = (parsed.students || []).map((s) => {
            if (s.studentIdNumber) return s;
            const newIdNumber = nextStudentIdNumber(assignedSoFar);
            assignedSoFar.push(newIdNumber);
            studentsChanged = true;
            return { ...s, studentIdNumber: newIdNumber };
          });

          setData(parsed);
          if (studentsChanged || renamedGrade) {
            window.storage.set(STORAGE_KEY, JSON.stringify(parsed), true).catch((e) => {
              console.error("Failed to save backfilled student ID numbers", e);
            });
          }
        }
        // No saved row yet is fine (brand new school), that is not an error.
        setLoaded(true);
      } catch (e) {
        // A real failure to reach storage. Do NOT mark this as loaded with
        // an empty dataset, that would risk a later save overwriting real
        // data with nothing. Show a blocking error instead.
        console.error("Failed to load school data", e);
        setLoadError(true);
      }
    })();
  }, []);

  const persist = async (next) => {
    if (loadError) {
      // Refuse to save if we never confirmed we loaded the real data first.
      console.error("Refusing to save: data was never successfully loaded.");
      return;
    }
    syncGlobalsFromSettings(next.settings);
    setData(next);
    setSaving(true);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(next), true);
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  };

  return { data, persist, loaded, saving, loadError };
}

function Field({ label, children }) {
  return (
    <label className="bsf-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="bsf-modal-backdrop" onClick={onClose}>
      <div className="bsf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bsf-modal-head">
          <h3>{title}</h3>
          <button className="bsf-iconbtn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="bsf-modal-body">{children}</div>
      </div>
    </div>
  );
}

function GradeLadder({ counts, activeGrade, onSelect }) {
  const max = Math.max(1, ...GRADES.map((g) => counts[g] || 0));
  return (
    <div className="bsf-ladder">
      {GRADES.map((g, i) => {
        const count = counts[g] || 0;
        const width = 24 + (count / max) * 76;
        const active = activeGrade === g;
        return (
          <button
            key={g}
            className={`bsf-rung ${active ? "active" : ""}`}
            onClick={() => onSelect(active ? null : g)}
          >
            <span className="bsf-rung-label">{g}</span>
            <span className="bsf-rung-track">
              <span className="bsf-rung-fill" style={{ width: `${width}%` }} />
            </span>
            <span className="bsf-rung-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

const SHORT_GRADE_LABEL = {
  "Pre-N": "Pre-N", "PreK": "PreK", "Kindergarten": "K",
  "Grade 1": "1", "Grade 2": "2", "Grade 3": "3", "Grade 4": "4",
  "Grade 5": "5", "Grade 6": "6", "Grade 7": "7"
};

function EnrollmentStairs({ counts, activeGrade = null, onSelect = null }) {
  const max = Math.max(1, ...GRADES.map((g) => counts[g] || 0));
  const interactive = !!onSelect;
  return (
    <div className="bsf-stairs">
      {GRADES.map((g) => {
        const count = counts[g] || 0;
        const heightPct = count === 0 ? 6 : 18 + (count / max) * 82;
        const isActive = activeGrade === g;
        const Tag = interactive ? "button" : "div";
        return (
          <Tag
            key={g}
            type={interactive ? "button" : undefined}
            className={`bsf-stair ${interactive ? "bsf-stair-interactive" : ""} ${isActive ? "active" : ""}`}
            onClick={interactive ? () => onSelect(isActive ? null : g) : undefined}
          >
            <span className="bsf-stair-count">{count > 0 ? count : ""}</span>
            <span className="bsf-stair-bar" style={{ height: `${heightPct}%` }} />
            <span className="bsf-stair-label">{SHORT_GRADE_LABEL[g] || g}</span>
          </Tag>
        );
      })}
    </div>
  );
}

function AvatarStack({ students }) {
  if (!students.length) return null;
  return (
    <div className="bsf-avatar-stack">
      {students.slice(0, 6).map((s, i) => (
        <div key={s.id} className="bsf-avatar-stack-item" style={{ zIndex: 10 - i }}>
          <StudentThumb photo={s.photo} />
        </div>
      ))}
      {students.length > 6 && <div className="bsf-avatar-stack-more">+{students.length - 6}</div>}
    </div>
  );
}

function Dashboard({ data, profile, persist }) {
  const { t, language } = useLanguage();
  const settings = data.settings || DEFAULT_SETTINGS;
  const isParent = profile?.role === "parent";
  const linkedIds = profile?.student_ids || [];
  const myStudents = isParent ? data.students.filter((s) => linkedIds.includes(s.id)) : [];

  const [signingDocId, setSigningDocId] = useState(null);
  const [signatureName, setSignatureName] = useState(profile?.full_name || "");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signatureConfirmed, setSignatureConfirmed] = useState(false);
  const [signatureError, setSignatureError] = useState("");
  const isAdmin = profile?.role === "admin";
  const LUNCH_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const LUNCH_DAY_LABELS = {
    en: { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri" },
    fr: { Monday: "Lun", Tuesday: "Mar", Wednesday: "Mer", Thursday: "Jeu", Friday: "Ven" }
  };
  const lunchMenu = data.lunchMenu || { weekOf: "", days: {} };
  const [editingLunch, setEditingLunch] = useState(false);
  const [lunchForm, setLunchForm] = useState(lunchMenu);

  const openLunchEdit = () => {
    setLunchForm(data.lunchMenu || { weekOf: "", days: {} });
    setEditingLunch(true);
  };

  const saveLunchMenu = () => {
    persist({ ...data, lunchMenu: lunchForm });
    setEditingLunch(false);
  };

  // Was: LUNCH_DAYS[new Date().getDay() - 1]. That was computed once per render,
  // so an open tab kept highlighting a stale day, and on Sat/Sun it read index
  // 5 / -1 and quietly produced undefined.
  const todayWeekday = useTodayWeekday();
  const todayLunchName = LUNCH_DAYS.includes(todayWeekday) ? todayWeekday : null;
  const activeLunchDays = language === "fr" ? (lunchMenu.daysFr || {}) : (lunchMenu.days || {});
  const hasLunchMenu = lunchMenu.weekOf || LUNCH_DAYS.some((d) => lunchMenu.days?.[d] || lunchMenu.daysFr?.[d]);

  const openSign = (docId) => {
    setSigningDocId(docId);
    setSignatureName(profile?.full_name || "");
    setSignatureDataUrl("");
    setSignatureConfirmed(false);
    setSignatureError("");
  };

  const saveSignature = () => {
    if (!signatureName.trim()) {
      setSignatureError("Please type your full name.");
      return;
    }
    if (!signatureDataUrl) {
      setSignatureError("Please sign in the box above.");
      return;
    }
    if (!signatureConfirmed) {
      setSignatureError("Please confirm you've read the document before signing.");
      return;
    }
    const signature = {
      id: uid(),
      parentId: profile.id,
      parentName: signatureName.trim(),
      signatureDataUrl,
      date: todayStr()
    };
    persist({
      ...data,
      resources: (data.resources || []).map((r) =>
        r.id === signingDocId ? { ...r, signatures: [...(r.signatures || []).filter((s) => s.parentId !== profile.id), signature] } : r
      )
    });
    setSigningDocId(null);
  };

  const balanceFor = (studentId) => computeFeeBreakdown(data, studentId).reduce((sum, item) => sum + item.due, 0);

  // Breaks a child's fees down by category (Registration, Tuition, Other), the
  // way a real school invoice would, rather than one lump number.
  const feeBreakdownFor = (studentId) => computeFeeBreakdown(data, studentId);

  const attendanceFor = (studentId) => attendanceCountsForRange(data.attendance, studentId);

  const counts = useMemo(() => {
    const c = {};
    data.students.forEach((s) => { c[s.grade] = (c[s.grade] || 0) + 1; });
    return c;
  }, [data.students]);

  const total = data.students.length;
  const recentPortfolio = [...data.portfolio]
    .filter((p) => !isParent || linkedIds.includes(p.studentId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const recentAnnouncements = [...data.announcements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  const today = todayStr();
  const nextEvents = [...(data.events || [])]
    .filter((e) => (e.endDate || e.date) >= today)
    .filter((e) => !isParent || !e.grades || e.grades.length === 0 || myStudents.some((s) => e.grades.includes(s.grade)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2);

  const recentStudents = isParent
    ? myStudents
    : [...data.students].sort((a, b) => (b.studentIdNumber || "").localeCompare(a.studentIdNumber || "")).slice(0, 6);

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">{t("dashboard.eyebrow")}</p>
        <h1>{isParent ? `Welcome back${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}` : "BrightSteps at a glance"}</h1>
        {!isParent && (
          <p className="bsf-hero-sub">{total} student{total === 1 ? "" : "s"} across {Object.keys(counts).length} grade level{Object.keys(counts).length === 1 ? "" : "s"}</p>
        )}
        {recentStudents.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <AvatarStack students={recentStudents} />
          </div>
        )}
        {settings.branding.mission && <p className="bsf-mission">{settings.branding.mission}</p>}
        {(settings.academicYear.startDate || settings.academicYear.endDate) && (
          <p className="bsf-muted">Academic year: {settings.academicYear.startDate || "?"} to {settings.academicYear.endDate || "?"}</p>
        )}
      </div>

         {isParent && (() => {
        const parentDocs = (data.resources || []).filter((d) => d.visibleToParents);
        if (parentDocs.length === 0) return null;
        return (
          <section className="bsf-card">
            <h2>School Documents</h2>
            <div className="bsf-list">
              {parentDocs.map((d) => {
                const mySignature = (d.signatures || []).find((s) => s.parentId === profile?.id);
                return (
                <div key={d.id} style={{ marginBottom: 14 }}>
                  <strong>{d.title}</strong>
                  {d.description && <p className="bsf-muted">{d.description}</p>}
                  {(d.files || []).length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <p className="bsf-muted" style={{ marginBottom: 2 }}>English</p>
                      <AttachmentField folder="resources" files={d.files} onChange={() => {}} readOnly />
                    </div>
                  )}
                  {(d.filesFr || []).length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <p className="bsf-muted" style={{ marginBottom: 2 }}>Français</p>
                      <AttachmentField folder="resources" files={d.filesFr} onChange={() => {}} readOnly />
                    </div>
                  )}
                  {d.requiresSignature && (
                    mySignature ? (
                      <p className="bsf-minitag" style={{ marginTop: 8, display: "inline-block" }}>Signed on {mySignature.date}</p>
                    ) : (
                      <button className="bsf-btn" style={{ marginTop: 8 }} onClick={() => openSign(d.id)}>Read and sign</button>
                    )
                  )}
                </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {signingDocId && (() => {
        const doc = (data.resources || []).find((d) => d.id === signingDocId);
        if (!doc) return null;
        return (
          <Modal title={`Sign: ${doc.title}`} onClose={() => setSigningDocId(null)}>
            <p className="bsf-muted" style={{ marginBottom: 12 }}>
              By signing below, you confirm you have read and understood this document.
            </p>
            <Field label="Your full name">
              <input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} />
            </Field>
            <Field label="Signature">
              <SignaturePad onChange={setSignatureDataUrl} />
            </Field>
            <label className="bsf-checkboxrow" style={{ marginBottom: 14 }}>
              <input type="checkbox" checked={signatureConfirmed} onChange={(e) => setSignatureConfirmed(e.target.checked)} />
              <span>I confirm I have read and understood {doc.title}.</span>
            </label>
            <button className="bsf-btn bsf-btn-block" onClick={saveSignature}>Submit signature</button>
            {signatureError && <p className="bsf-formerror">{signatureError}</p>}
          </Modal>
        );
      })()}

      {isParent && myStudents.length === 0 && (
        <section className="bsf-card">
          <p className="bsf-empty">No child linked to your account yet. Please contact the school administrator.</p>
        </section>
      )}

      {isParent && myStudents.map((s) => {
        const balance = balanceFor(s.id);
        const attend = attendanceFor(s.id);
        const feeItems = feeBreakdownFor(s.id);
        return (
          <div key={s.id}>
            <section className="bsf-card">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <StudentThumb photo={s.photo} />
                <div>
                  <strong style={{ fontFamily: "'Fraunces', serif", fontSize: 17 }}>{s.name}</strong>
                  <p className="bsf-muted" style={{ margin: 0 }}>
                    {s.grade}{(s.nationalities && s.nationalities.length) ? ` · ${s.nationalities.join(" - ")}` : (s.nationality ? ` · ${s.nationality}` : "")}
                  </p>
                </div>
              </div>
              {s.allergies && <p className="bsf-alert-note">Allergies: {s.allergies}</p>}
            </section>

            <section className="bsf-card bsf-invoicecard">
              <div className="bsf-invoicehead">
                <div>
                  <p className="bsf-eyebrow" style={{ margin: 0 }}>Tuition & Fees</p>
                  <p className="bsf-muted" style={{ margin: "2px 0 0" }}>{s.firstName || s.name.split(" ")[0]} · {settings.academicYear.startDate ? settings.academicYear.startDate.slice(0, 4) : ""}{settings.academicYear.endDate ? `–${settings.academicYear.endDate.slice(2, 4)}` : ""}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p className="bsf-invoicetotal" style={{ color: balance > 0 ? "#B23A3A" : "#2F7A5C" }}>{formatCurrency(Math.abs(balance))}</p>
                  <p className="bsf-muted" style={{ margin: 0 }}>{balance > 0 ? "Total balance due" : balance < 0 ? "Credit on file" : "Fully settled"}</p>
                </div>
              </div>

              {feeItems.length === 0 ? (
                <p className="bsf-empty">No fee schedule set yet, contact the school office for details.</p>
              ) : (
                <div className="bsf-invoicelines">
                  {feeItems.map((item) => {
                    const statusColor = item.status === "Paid in full" ? "#2F7A5C" : item.status === "Waived" ? "#6B5B95" : item.status === "Partially paid" ? "#B8842F" : item.status === "No fee set" ? "#8A9698" : "#B23A3A";
                    const CatIcon = feeCategoryIcon(item.category);
                    return (
                      <div key={item.category} className="bsf-invoiceline">
                        <div className="bsf-invoiceline-top">
                          <div className="bsf-invoiceline-label">
                            <span className="bsf-invoiceline-icon" style={{ background: `${statusColor}1A`, color: statusColor }}><CatIcon size={15} /></span>
                            <strong>{item.category === "Registration" ? "Registration Fee" : item.category}</strong>
                          </div>
                          <span className="bsf-status-pill" style={{ background: `${statusColor}1A`, color: statusColor }}>{item.status}</span>
                        </div>
                        <div className="bsf-invoicebar">
                          <span style={{ width: `${item.pct}%`, background: statusColor }} />
                        </div>
                        {item.waived ? (
                          <p className="bsf-muted" style={{ margin: "4px 0 0" }}>Real price {formatCurrency(item.listPrice)} · fully waived</p>
                        ) : item.discountAmount > 0 ? (
                          <p className="bsf-muted" style={{ margin: "4px 0 0" }}>
                            Real price {formatCurrency(item.listPrice)} · {formatCurrency(item.discountAmount)} discount{item.discountReason ? ` (${item.discountReason})` : ""}
                          </p>
                        ) : null}
                        <div className="bsf-invoiceline-bottom">
                          <span className="bsf-muted">{formatCurrency(item.paid)} paid of {formatCurrency(item.charged)} owed</span>
                          {item.due > 0 && <span style={{ color: statusColor, fontWeight: 600 }}>{formatCurrency(item.due)} due</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {(() => {
              const history = [...(data.billing || [])].filter((b) => b.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date));
              if (history.length === 0) return null;
              return (
                <section className="bsf-card">
                  <h2>Transaction history</h2>
                  <div className="bsf-list">
                    {history.map((b) => {
                      const isPayment = b.type !== "charge";
                      return (
                        <div key={b.id} className="bsf-txnrow" style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                          <span className="bsf-txnicon" style={{ background: isPayment ? "#E6F2EC" : "#FCE8E8", color: isPayment ? "#2F7A5C" : "#B23A3A" }}>
                            {isPayment ? "+" : "−"}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div className="bsf-row-head">
                              <strong style={{ color: isPayment ? "#2F7A5C" : "#B23A3A" }}>{formatCurrency(b.amount)}</strong>
                              <span className="bsf-muted">{b.date}</span>
                            </div>
                            <p className="bsf-muted" style={{ margin: 0 }}>{b.category || "Tuition"}{b.description ? ` · ${b.description}` : ""}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })()}

            <section className="bsf-card">
              <h2>Attendance for {s.firstName || s.name.split(" ")[0]}</h2>
              <p className="bsf-muted">{attend.present} present · {attend.absent} absent · {attend.late} late this year</p>
            </section>
          </div>
        );
      })}

      {!isParent && (
        <section className="bsf-card bsf-stairs-card">
          <h2>Enrollment by grade</h2>
          <EnrollmentStairs counts={counts} />
        </section>
      )}

      <div className="bsf-dashboard-grid">
        <section className="bsf-card">
          <h2>Next up</h2>
          {nextEvents.length === 0 && <p className="bsf-empty">Nothing scheduled yet.{!isParent && " Add one from the Calendar tab."}</p>}
          {nextEvents.map((e) => (
            <div key={e.id} className="bsf-row">
              <span
                className="bsf-status-pill"
                style={{ background: `${EVENT_TYPE_COLOR[e.type]}1A`, color: EVENT_TYPE_COLOR[e.type] }}
              >
                {e.type}
              </span>
              <div>
                <strong>{e.title}</strong>
                <p>{e.date}{e.endDate && e.endDate !== e.date ? ` to ${e.endDate}` : ""}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="bsf-card">
          <h2>Family updates</h2>
          {recentAnnouncements.length === 0 && <p className="bsf-empty">Nothing posted yet.{!isParent && " Share one from Family Updates."}</p>}
          {recentAnnouncements.map((a) => {
            const showFrench = isParent && language === "fr" && a.titleFr;
            return (
              <div key={a.id} className="bsf-row">
                <div>
                  <strong>{showFrench ? a.titleFr : a.titleEn}</strong>
                  <p>{showFrench ? a.bodyFr : a.bodyEn}</p>
                </div>
              </div>
            );
          })}
        </section>
      </div> 
           <section className="bsf-card">
        <div className="bsf-row-head">
          <h2>Lunch Menu</h2>
          {isAdmin && !editingLunch && (
            <button className="bsf-textbtn" onClick={openLunchEdit}>Edit menu</button>
          )}
        </div>
        {lunchMenu.weekOf && <p className="bsf-muted" style={{ marginBottom: 8 }}>Week of {lunchMenu.weekOf}</p>}
        {hasLunchMenu && LUNCH_DAYS.map((day) => (
          <div key={day} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 8, padding: "8px 10px", borderRadius: 8, background: day === todayLunchName ? "#eaf1fb" : "transparent" }}>
            <p style={{ fontWeight: 500, fontSize: 13, margin: 0, color: day === todayLunchName ? "#185fa5" : "#666" }}>
              {LUNCH_DAY_LABELS[language]?.[day] || day}
              {day === todayLunchName && <><br /><span style={{ fontWeight: 400, fontSize: 11 }}>Today</span></>}
            </p>
            <p style={{ fontSize: 13, margin: 0 }}>
              {activeLunchDays[day]?.dish || "—"}
              {activeLunchDays[day]?.dessert && <span style={{ color: "#888" }}> · {activeLunchDays[day].dessert}</span>}
            </p>
          </div>
        ))}
      </section>

      {editingLunch && (
        <Modal title="Edit lunch menu" onClose={() => setEditingLunch(false)}>
          <Field label="Week of">
            <input
              value={lunchForm.weekOf || ""}
              onChange={(e) => setLunchForm({ ...lunchForm, weekOf: e.target.value })}
              placeholder="e.g. Aug 31, 2026"
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr", gap: "6px 8px", fontSize: 12, color: "#888", marginTop: 12 }}>
            <span></span><span>English</span><span>Français</span>
          </div>
          {LUNCH_DAYS.map((day) => (
            <div key={day}>
              <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr", gap: "6px 8px", alignItems: "center", padding: "6px 0", borderTop: "1px solid #eee" }}>
                <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{LUNCH_DAY_LABELS.en[day]}</p>
                <input
                  value={lunchForm.days?.[day]?.dish || ""}
                  onChange={(e) => setLunchForm({ ...lunchForm, days: { ...lunchForm.days, [day]: { ...lunchForm.days?.[day], dish: e.target.value } } })}
                  placeholder="Dish"
                  style={{ height: 30, fontSize: 13 }}
                />
                <input
                  value={lunchForm.daysFr?.[day]?.dish || ""}
                  onChange={(e) => setLunchForm({ ...lunchForm, daysFr: { ...lunchForm.daysFr, [day]: { ...lunchForm.daysFr?.[day], dish: e.target.value } } })}
                  placeholder="Plat"
                  style={{ height: 30, fontSize: 13 }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr", gap: "6px 8px", alignItems: "center", padding: "0 0 8px" }}>
                <span></span>
                <input
                  value={lunchForm.days?.[day]?.dessert || ""}
                  onChange={(e) => setLunchForm({ ...lunchForm, days: { ...lunchForm.days, [day]: { ...lunchForm.days?.[day], dessert: e.target.value } } })}
                  placeholder="Dessert"
                  style={{ height: 30, fontSize: 13 }}
                />
                <input
                  value={lunchForm.daysFr?.[day]?.dessert || ""}
                  onChange={(e) => setLunchForm({ ...lunchForm, daysFr: { ...lunchForm.daysFr, [day]: { ...lunchForm.daysFr?.[day], dessert: e.target.value } } })}
                  placeholder="Dessert"
                  style={{ height: 30, fontSize: 13 }}
                />
              </div>
            </div>
          ))}
          <button className="bsf-btn bsf-btn-block" onClick={saveLunchMenu} style={{ marginTop: 14 }}>Save menu</button>
        </Modal>
      )}

      <section className="bsf-card">
        <h2>{isParent ? "Latest portfolio entries for your child" : "Latest portfolio entries"}</h2>
        {recentPortfolio.length === 0 && <p className="bsf-empty">No entries yet.{!isParent && " Add one from the Portfolio tab."}</p>}
        {recentPortfolio.map((p) => {
          const student = data.students.find((s) => s.id === p.studentId);
          return (
            <div key={p.id} className="bsf-row bsf-portfolio-row">
              {student && <StudentThumb photo={student.photo} />}
              <div style={{ flex: 1 }}>
                <div className="bsf-row-head">
                  <strong>{p.studentName}</strong>
                  <span className="bsf-tag">{p.tag}</span>
                </div>
                <p>{p.note}</p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function FamilyViewModal({ student, data, onClose }) {
  const today = todayStr();
  const settings = data.settings || DEFAULT_SETTINGS;
  const terms = settings.terms || DEFAULT_SETTINGS.terms;

  const attendanceSummary = useMemo(
    () => attendanceCountsForRange(data.attendance, student.id),
    [data.attendance, student.id]
  );

  const termSummaries = useMemo(
    () => terms
      .filter((term) => term.startDate && term.endDate)
      .map((term) => ({ ...term, counts: attendanceCountsForRange(data.attendance, student.id, term.startDate, term.endDate) })),
    [data.attendance, student.id, terms]
  );

  const portfolioEntries = [...data.portfolio]
    .filter((p) => p.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const assessments = [...(data.assessments || [])]
    .filter((a) => a.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const events = [...(data.events || [])]
    .filter((e) => (e.endDate || e.date) >= today)
    .filter((e) => !e.grades || e.grades.length === 0 || e.grades.includes(student.grade))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const assignmentsDue = [...(data.assignments || [])]
    .filter((a) => !a.dueDate || a.dueDate >= today)
    .filter((a) => (a.grades || []).includes(student.grade))
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
    .slice(0, 5);

  const announcements = [...data.announcements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  return (
    <Modal title={`${student.name}'s family view`} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <StudentThumb photo={student.photo} />
        <p className="bsf-muted" style={{ margin: 0 }}>
          This is a preview of what a parent would see for {student.name}. It isn't a separate login yet.
        </p>
      </div>

      <section className="bsf-card">
        <h2>Guardians</h2>
        {(student.guardian1Name || student.guardianName) ? (
          <p>
            {student.guardian1Name || student.guardianName}
            {student.guardian1Relationship ? ` (${student.guardian1Relationship})` : ""}
            {(student.guardian1Phone || student.guardianContact) ? ` · ${student.guardian1Phone || student.guardianContact}` : ""}
          </p>
        ) : (
          <p className="bsf-empty">No guardian on file yet.</p>
        )}
        {student.guardian2Name && (
          <p>
            {student.guardian2Name}
            {student.guardian2Relationship ? ` (${student.guardian2Relationship})` : ""}
            {student.guardian2Phone ? ` · ${student.guardian2Phone}` : ""}
          </p>
        )}
        {(student.allergies || student.medicalConditions) && (
          <p className="bsf-alert-note">
            {student.allergies ? `Allergies: ${student.allergies}. ` : ""}
            {student.medicalConditions ? `Medical: ${student.medicalConditions}` : ""}
          </p>
        )}
      </section>

      <section className="bsf-card">
        <h2>Reports</h2>
        {(data.reports || []).filter((r) => r.studentId === student.id).length === 0 && (
          <p className="bsf-empty">No reports generated yet.</p>
        )}
        {(data.reports || [])
          .filter((r) => r.studentId === student.id)
          .sort((a, b) => b.createdDate.localeCompare(a.createdDate))
          .map((r) => (
            <div key={r.id} className="bsf-row">
              <span className="bsf-tag">{r.template}</span>
              <div>
                <strong>{r.periodStart || "?"} to {r.periodEnd || "?"}</strong>
                <p>{r.createdDate}</p>
              </div>
            </div>
          ))}
      </section>

      <section className="bsf-card">
        <h2>Attendance</h2>
        <p className="bsf-muted">
          {attendanceSummary.present} present · {attendanceSummary.absent} absent · {attendanceSummary.late} late this year
        </p>
        {termSummaries.length > 0 && (
          <div className="bsf-termsummary">
            {termSummaries.map((term) => (
              <div key={term.name} className="bsf-termsummary-row">
                <span className="bsf-tag">{term.name}</span>
                <span className="bsf-muted">
                  {term.counts.present} present · {term.counts.absent} absent · {term.counts.late} late
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bsf-card">
        <h2>Upcoming for {student.grade}</h2>
        {events.length === 0 && <p className="bsf-empty">Nothing scheduled yet.</p>}
        {events.map((e) => (
          <div key={e.id} className="bsf-row">
            <span className="bsf-status-pill" style={{ background: `${EVENT_TYPE_COLOR[e.type]}1A`, color: EVENT_TYPE_COLOR[e.type] }}>
              {e.type}
            </span>
            <div>
              <strong>{e.title}</strong>
              <p>{e.date}{e.endDate && e.endDate !== e.date ? ` to ${e.endDate}` : ""}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="bsf-card">
        <h2>Assignments due</h2>
        {assignmentsDue.length === 0 && <p className="bsf-empty">Nothing assigned right now.</p>}
        {assignmentsDue.map((a) => (
          <div key={a.id} className="bsf-row">
            {a.subject && <span className="bsf-tag">{a.subject}</span>}
            <div>
              <strong>{a.title}</strong>
              {a.dueDate && <p className="bsf-muted">Due {a.dueDate}</p>}
              {a.description && <p>{a.description}</p>}
            </div>
          </div>
        ))}
      </section>

      <section className="bsf-card">
        <h2>Portfolio</h2>
        {portfolioEntries.length === 0 && <p className="bsf-empty">No portfolio entries yet.</p>}
        {portfolioEntries.map((p) => (
          <div key={p.id} className="bsf-row">
            <span className="bsf-tag">{p.tag}</span>
            <div>
              <div className="bsf-row-head">
                <span className={`bsf-author-badge ${p.author === "student" ? "student" : "teacher"}`}>
                  {p.author === "student" ? "Student reflection" : "Teacher note"}
                </span>
                <span className="bsf-muted">{p.date}</span>
              </div>
              <p>{p.note}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="bsf-card">
        <h2>Assessments</h2>
        {assessments.length === 0 && <p className="bsf-empty">No assessments recorded yet.</p>}
        {assessments.map((a) => (
          <div key={a.id} className="bsf-row">
            {a.rows && a.rows.length > 0 ? (
              <span className="bsf-tag">{a.rubricName || "Rubric"}</span>
            ) : (
              <span className="bsf-status-pill" style={{ background: `${getLevelColor(a.level)}1A`, color: getLevelColor(a.level) }}>
                {a.level}
              </span>
            )}
            <div>
              <p className="bsf-muted">{a.date}{a.subject ? ` · ${a.subject}` : ""}</p>
              {a.rows && a.rows.length > 0 ? (
                <div className="bsf-rubric-rows">
                  {a.rows.map((r, i) => (
                    <div key={i} className="bsf-rubric-row">
                      <span>{r.text}</span>
                      <span className="bsf-status-pill" style={{ background: `${getLevelColor(r.level)}1A`, color: getLevelColor(r.level) }}>{r.level}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{a.criteria}</p>
              )}
              {a.feedback && <p className="bsf-muted">{a.feedback}</p>}
            </div>
          </div>
        ))}
      </section>

      <section className="bsf-card">
        <h2>Family updates</h2>
        {announcements.length === 0 && <p className="bsf-empty">Nothing posted yet.</p>}
        {announcements.map((a) => (
          <div key={a.id} className="bsf-row">
            <div>
              <strong>{a.titleEn}</strong>
              <p>{a.bodyEn}</p>
            </div>
          </div>
        ))}
      </section>
    </Modal>
  );
}

const emptyStudentForm = {
  firstName: "", middleName: "", lastName: "", grade: GRADES[0], dob: "", gender: "", nationalities: [],
  photo: null,
  guardian1Name: "", guardian1Relationship: "", guardian1Phone: "", guardian1Email: "",
  guardian2Name: "", guardian2Relationship: "", guardian2Phone: "", guardian2Email: "",
  allergies: "", medicalConditions: "",
  emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelationship: "",
  enrollmentDate: "", previousSchool: "", homeAddress: ""
};

const fullName = (p) => [p.firstName, p.middleName, p.lastName].filter((x) => x && x.trim()).join(" ");

function SignaturePad({ onChange }) {
  const [typed, setTyped] = useState("");

  const handle = (value) => {
    setTyped(value);
    if (onChange) onChange(value.trim());
  };

  return (
    <div>
      <input
        value={typed}
        onChange={(e) => handle(e.target.value)}
        placeholder="Type your full name"
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 22,
          padding: "14px 12px",
          width: "100%",
          border: "1px solid #EAD7DA",
          borderRadius: 12,
          background: "#FCFAF4",
          color: "#241012"
        }}
      />
      <p className="bsf-muted" style={{ marginTop: 6 }}>
        Typing your name here counts as your signature.
      </p>
    </div>
  );
}

function StudentThumb({ photo }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (!photo || !photo.path) { setUrl(""); return; }
    getAttachmentUrl(photo.path).then((u) => { if (!cancelled) setUrl(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [photo && photo.path]);
  return (
    <div className="bsf-student-thumb">
      {url ? <img src={url} alt="" /> : <Users size={18} />}
    </div>
  );
}

const GENDERS = ["Female", "Male", "Prefer not to say"];

const COUNTRIES = ["Afghanistan","Albania","Algeria","Andorra","Angola","Antigua & Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia & Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon","Canada","Cape Verde","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo - Brazzaville","Congo - Kinshasa","Costa Rica","Cote d'Ivoire","Croatia","Cuba","Cyprus","Czechia","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar (Burma)","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Samoa","San Marino","Sao Tome & Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","St. Kitts & Nevis","St. Lucia","St. Vincent & Grenadines","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad & Tobago","Tunisia","Turkiye","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"];

function StudentMessages({ student, data, persist }) {
  const { profile } = useAuth();
  const [messageText, setMessageText] = useState("");

  useEffect(() => {
    if (!profile?.id || !student?.id) return;
    if ((student.messages || []).length === 0) return;
    persist({
      ...data,
      students: data.students.map((s) =>
        s.id === student.id ? { ...s, lastRead: { ...(s.lastRead || {}), [profile.id]: new Date().toISOString() } } : s
      )
    });
    // Only re-run when switching to a different student, not on every persist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, profile?.id]);

  const addMessage = () => {
    if (!messageText.trim()) return;
    const message = {
      id: uid(),
      author: (profile && profile.full_name) || "Someone",
      role: (profile && profile.role) || "",
      text: messageText.trim(),
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString()
    };
    persist({
      ...data,
      students: data.students.map((s) =>
        s.id === student.id
          ? { ...s, messages: [...(s.messages || []), message], lastRead: { ...(s.lastRead || {}), [profile.id]: message.createdAt } }
          : s
      )
    });
    setMessageText("");    supabase.functions.invoke("notify-message", { body: { studentId: student.id, senderRole: (profile && profile.role) || "", senderName: (profile && profile.full_name) || "Someone" } }).catch((e) => console.error("notify-message failed", e));
  };

  const removeMessage = (msgId) => {
    persist({
      ...data,
      students: data.students.map((s) => (s.id === student.id ? { ...s, messages: (s.messages || []).filter((m) => m.id !== msgId) } : s))
    });
  };

  const initials = (name) =>
    (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  const messages = student.messages || [];
  let lastDate = null;
  const isOwnThread = profile?.role === "student";

  return (
    <>
      <div className="bsf-msg-header">
        <div>
          <h3 className="bsf-subheading" style={{ margin: 0 }}>Messages</h3>
          <p className="bsf-muted">
            {isOwnThread
              ? "A private thread between you and your teachers."
              : `A private thread between parents and teachers about ${student.name}.`}
          </p>
        </div>
      </div>
      <div className="bsf-chatthread">
        {messages.length === 0 && <p className="bsf-empty">{isOwnThread ? "No messages yet. Say hello to your teacher below." : "No messages yet. Say hello below."}</p>}
        {messages.map((m) => {
          const isMine = profile && m.author === profile.full_name && m.role === profile.role;
          const showDateDivider = m.date !== lastDate;
          lastDate = m.date;
          return (
            <Fragment key={m.id}>
              {showDateDivider && <div className="bsf-chatdate">{m.date}</div>}
              <div className={`bsf-chatrow ${isMine ? "mine" : ""}`}>
                {!isMine && <div className="bsf-chatavatar">{initials(m.author)}</div>}
                <div className="bsf-chatbubble">
                  {!isMine && <div className="bsf-chatauthor">{m.author}{m.role ? ` · ${m.role}` : ""}</div>}
                  <p>{m.text}</p>
                                   {(isMine || profile?.role === "admin") && (
                  <button className="bsf-chatremove" onClick={() => removeMessage(m.id)} aria-label="Remove message">
                    <X size={12} />
                  </button>
              )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
      <div className="bsf-chatinputbar">
        <textarea
          rows={1}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Write a message..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addMessage(); }
          }}
        />
        <button className="bsf-chatsendbtn" onClick={addMessage} aria-label="Send message" disabled={!messageText.trim()}>
          <Send size={18} />
        </button>
      </div>
    </>
  );
}

function ParentStudentView({ data, persist, profile }) {
  const linkedIds = profile?.student_ids || [];
  const myStudents = data.students.filter((s) => linkedIds.includes(s.id));
  const [activeChildId, setActiveChildId] = useState(null);
  const today = todayStr();

  const activeStudent = myStudents.find((s) => s.id === activeChildId) || myStudents[0];
  const settings = data.settings || DEFAULT_SETTINGS;
  const terms = settings.terms || DEFAULT_SETTINGS.terms;

  const attendanceSummary = useMemo(
    () => (activeStudent ? attendanceCountsForRange(data.attendance, activeStudent.id) : { present: 0, absent: 0, late: 0 }),
    [data.attendance, activeStudent]
  );

  const termSummaries = useMemo(() => {
    if (!activeStudent) return [];
    return terms
      .filter((term) => term.startDate && term.endDate)
      .map((term) => ({ ...term, counts: attendanceCountsForRange(data.attendance, activeStudent.id, term.startDate, term.endDate) }));
  }, [data.attendance, activeStudent, terms]);

  const billingHistory = activeStudent
    ? [...(data.billing || [])].filter((b) => b.studentId === activeStudent.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const billingBalance = billingHistory.reduce((sum, b) => sum + (b.type === "charge" ? Number(b.amount || 0) : -Number(b.amount || 0)), 0);

  const portfolioEntries = activeStudent
    ? [...data.portfolio].filter((p) => p.studentId === activeStudent.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const assessments = activeStudent
    ? [...(data.assessments || [])].filter((a) => a.studentId === activeStudent.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const events = activeStudent
    ? [...(data.events || [])]
        .filter((e) => (e.endDate || e.date) >= today)
        .filter((e) => !e.grades || e.grades.length === 0 || e.grades.includes(activeStudent.grade))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 4)
    : [];

  const assignmentsDue = activeStudent
    ? [...(data.assignments || [])]
        .filter((a) => !a.dueDate || a.dueDate >= today)
        .filter((a) => (a.grades || []).includes(activeStudent.grade))
        .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
        .slice(0, 5)
    : [];

  const reports = activeStudent
    ? (data.reports || []).filter((r) => r.studentId === activeStudent.id).sort((a, b) => b.createdDate.localeCompare(a.createdDate))
    : [];

  if (myStudents.length === 0) {
    return (
      <div className="bsf-screen">
        <div className="bsf-screen-head"><h1>My child</h1></div>
        <p className="bsf-empty">No student is linked to your account yet. Please contact the school administrator.</p>
      </div>
    );
  }

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <div>
          <h1>My child</h1>
          {profile?.full_name && <p className="bsf-muted" style={{ marginTop: 2 }}>Signed in as {profile.full_name}</p>}
        </div>
      </div>

      {myStudents.length > 1 && (
        <div className="bsf-card" style={{ display: "flex", gap: 10, overflowX: "auto", padding: 12 }}>
          {myStudents.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveChildId(s.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer", flexShrink: 0,
                opacity: (activeStudent && activeStudent.id === s.id) ? 1 : 0.5
              }}
            >
              <div style={{
                border: (activeStudent && activeStudent.id === s.id) ? "2px solid #801524" : "2px solid transparent",
                borderRadius: "50%", padding: 2
              }}>
                <StudentThumb photo={s.photo} />
              </div>
              <span style={{ fontSize: 12 }}>{s.firstName || s.name}</span>
            </button>
          ))}
        </div>
      )}

      {activeStudent && (
        <>
          <section className="bsf-card">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <StudentThumb photo={activeStudent.photo} />
              <div>
                <strong>{activeStudent.name}</strong>
                <p className="bsf-muted">{activeStudent.grade}</p>
              </div>
            </div>
            {activeStudent.allergies && <p className="bsf-alert-note">Allergies: {activeStudent.allergies}</p>}
            {activeStudent.medicalConditions && <p className="bsf-alert-note">Medical: {activeStudent.medicalConditions}</p>}
          </section>

          <section className="bsf-card">
            <h2>Attendance</h2>
            <p className="bsf-muted">
              {attendanceSummary.present} present · {attendanceSummary.absent} absent · {attendanceSummary.late} late this year
            </p>
            {termSummaries.length > 0 && (
              <div className="bsf-termsummary">
                {termSummaries.map((term) => (
                  <div key={term.name} className="bsf-termsummary-row">
                    <span className="bsf-tag">{term.name}</span>
                    <span className="bsf-muted">
                      {term.counts.present} present · {term.counts.absent} absent · {term.counts.late} late
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bsf-card">
            <h2>Upcoming for {activeStudent.grade}</h2>
            {events.length === 0 && <p className="bsf-empty">Nothing scheduled yet.</p>}
            {events.map((e) => (
              <div key={e.id} className="bsf-row">
                <span className="bsf-status-pill" style={{ background: `${EVENT_TYPE_COLOR[e.type]}1A`, color: EVENT_TYPE_COLOR[e.type] }}>
                  {e.type}
                </span>
                <div>
                  <strong>{e.title}</strong>
                  <p>{e.date}{e.endDate && e.endDate !== e.date ? ` to ${e.endDate}` : ""}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="bsf-card">
            <h2>Assignments due</h2>
            {assignmentsDue.length === 0 && <p className="bsf-empty">Nothing assigned right now.</p>}
            {assignmentsDue.map((a) => (
              <div key={a.id} className="bsf-row">
                {a.subject && <span className="bsf-tag">{a.subject}</span>}
                <div>
                  <strong>{a.title}</strong>
                  {a.dueDate && <p className="bsf-muted">Due {a.dueDate}</p>}
                  {a.description && <p>{a.description}</p>}
                </div>
              </div>
            ))}
          </section>

          <section className="bsf-card">
            <h2>Portfolio</h2>
            {portfolioEntries.length === 0 && <p className="bsf-empty">No portfolio entries yet.</p>}
            {portfolioEntries.map((p) => (
              <div key={p.id} className="bsf-row">
                <span className="bsf-tag">{p.tag}</span>
                <div>
                  <div className="bsf-row-head">
                    <span className={`bsf-author-badge ${p.author === "student" ? "student" : "teacher"}`}>
                      {p.author === "student" ? "Student reflection" : "Teacher note"}
                    </span>
                    <span className="bsf-muted">{p.date}</span>
                  </div>
                  <p>{p.note}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="bsf-card">
            <h2>Assessments</h2>
            {assessments.length === 0 && <p className="bsf-empty">No assessments recorded yet.</p>}
            {assessments.map((a) => (
              <div key={a.id} className="bsf-row">
                {a.rows && a.rows.length > 0 ? (
                  <span className="bsf-tag">{a.rubricName || "Rubric"}</span>
                ) : (
                  <span className="bsf-status-pill" style={{ background: `${getLevelColor(a.level)}1A`, color: getLevelColor(a.level) }}>
                    {a.level}
                  </span>
                )}
                <div>
                  <p className="bsf-muted">{a.date}{a.subject ? ` · ${a.subject}` : ""}</p>
                  {a.rows && a.rows.length > 0 ? (
                    <div className="bsf-rubric-rows">
                      {a.rows.map((r, i) => (
                        <div key={i} className="bsf-rubric-row">
                          <span>{r.text}</span>
                          <span className="bsf-status-pill" style={{ background: `${getLevelColor(r.level)}1A`, color: getLevelColor(r.level) }}>{r.level}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>{a.criteria}</p>
                  )}
                  {a.feedback && <p className="bsf-muted">{a.feedback}</p>}
                </div>
              </div>
            ))}
          </section>

          <section className="bsf-card">
            <h2>Reports</h2>
            {reports.length === 0 && <p className="bsf-empty">No reports generated yet.</p>}
            {reports.map((r) => (
              <div key={r.id} className="bsf-row">
                <span className="bsf-tag">{r.template}</span>
                <div>
                  <strong>{r.periodStart || "?"} to {r.periodEnd || "?"}</strong>
                  <p>{r.createdDate}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="bsf-card">
            <StudentMessages student={activeStudent} data={data} persist={persist} />
          </section>
        </>
      )}
    </div>
  );
}

function AccountSetupHelper({ student }) {
  const [copiedWhich, setCopiedWhich] = useState("");

  const copy = async (which, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWhich(which);
      setTimeout(() => setCopiedWhich(""), 2500);
    } catch {
      setCopiedWhich("error");
      setTimeout(() => setCopiedWhich(""), 2500);
    }
  };

  const parentSql = `-- Step 1: In Authentication -> Add user, create the parent's login with their real email.
-- Step 2: Copy the User UID it gives you, paste it in place of PASTE_USER_UID_HERE below.
-- Step 3: Replace the placeholder name and email with the real ones, then run this.
insert into profiles (id, full_name, email, role, student_ids)
values (
  'PASTE_USER_UID_HERE',
  'Parent Full Name',
  'parent-real-email@example.com',
  'parent',
  array['${student.id}']
);`;

  const studentEmail = student.studentIdNumber ? `${student.studentIdNumber}@students.brightstepshub.local` : "STUDENT_ID@students.brightstepshub.local";
  const studentSql = `-- Step 1: In Authentication -> Add user, use this exact email: ${studentEmail}
-- Choose any password, then click Create user.
-- Step 2: Copy the User UID it gives you, paste it in place of PASTE_USER_UID_HERE below.
-- Step 3: Run this, nothing else to change, it's already filled in for ${student.name}.
insert into profiles (id, full_name, email, role, student_ids)
values (
  'PASTE_USER_UID_HERE',
  '${student.name}',
  '${studentEmail}',
  'student',
  array['${student.id}']
);`;

  return (
    <div className="bsf-inlinenote">
      <p style={{ marginBottom: 8 }}>Account link code: <code>{student.id}</code></p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="bsf-btn bsf-btn-ghost" onClick={() => copy("parent", parentSql)}>
          {copiedWhich === "parent" ? "Copied!" : "Copy parent setup SQL"}
        </button>
        <button type="button" className="bsf-btn bsf-btn-ghost" onClick={() => copy("student", studentSql)}>
          {copiedWhich === "student" ? "Copied!" : "Copy student setup SQL"}
        </button>
      </div>
      {copiedWhich === "error" && <p className="bsf-formerror">Couldn't copy automatically, you can still select the text manually.</p>}
      <p className="bsf-muted" style={{ marginTop: 8 }}>
        This fills in {student.name}'s real details for you. You'll still need to create the login itself in Supabase's Authentication tab, that one step can't be skipped, but you'll never have to type their name or account code by hand again.
      </p>
    </div>
  );
}

function StudentsTab({ data, persist, profile }) {
  const [activeGrade, setActiveGrade] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [familyViewId, setFamilyViewId] = useState(null);
  const [form, setForm] = useState(emptyStudentForm);
  const [formError, setFormError] = useState("");

  const isLearningAssistant = profile?.role === "learning_assistant";
  const isTeacherRole = profile?.role === "teacher" || isLearningAssistant;
  const myAssignedGrades = profile?.grades_assigned || [];
  const canEditStudents = !isTeacherRole;

  const importBulkStudents = () => {
    setBulkError("");
    setBulkSuccess("");
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setBulkError("Paste one student per line before importing.");
      return;
    }
    const newStudents = [];
    const idNumbersSoFar = data.students.map((s) => s.studentIdNumber).filter(Boolean);
    for (const line of lines) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length < 4) {
        setBulkError(`This line is missing some fields, each line needs at least First Name | Last Name | Grade | Guardian Name: "${line.slice(0, 50)}..."`);
        return;
      }
      const [firstName, lastName, grade, guardianName, guardianPhone = "", allergies = ""] = parts;
      if (!GRADES.includes(grade)) {
        setBulkError(`"${grade}" isn't a valid grade name. Use exactly: ${GRADES.join(", ")}`);
        return;
      }
      const studentIdNumber = nextStudentIdNumber(idNumbersSoFar);
      idNumbersSoFar.push(studentIdNumber);
      newStudents.push({
        id: uid(),
        studentIdNumber,
        firstName, middleName: "", lastName, grade,
        name: [firstName, lastName].filter(Boolean).join(" "),
        dob: "", gender: "", nationalities: [], photo: null,
        guardian1Name: guardianName, guardian1Relationship: "", guardian1Phone: guardianPhone, guardian1Email: "",
        guardian2Name: "", guardian2Relationship: "", guardian2Phone: "", guardian2Email: "",
        allergies, medicalConditions: "",
        emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelationship: "",
        enrollmentDate: "", previousSchool: "", homeAddress: ""
      });
    }
    persist({ ...data, students: [...data.students, ...newStudents] });
    setBulkText("");
    setBulkSuccess(`Added ${newStudents.length} student${newStudents.length === 1 ? "" : "s"}. You can open each one afterward to fill in anything extra, like nationality or medical notes.`);
  };

  const visibleStudents = isTeacherRole
    ? data.students.filter((s) => myAssignedGrades.includes(s.grade))
    : data.students;

  const counts = useMemo(() => {
    const c = {};
    visibleStudents.forEach((s) => { c[s.grade] = (c[s.grade] || 0) + 1; });
    return c;
  }, [visibleStudents]);

  const filtered = (activeGrade ? visibleStudents.filter((s) => s.grade === activeGrade) : visibleStudents)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const familyViewStudent = visibleStudents.find((s) => s.id === familyViewId);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyStudentForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (student) => {
    if (!canEditStudents) return;
    setEditingId(student.id);
    const base = student.firstName ? student : { ...student, firstName: student.name || "", middleName: "", lastName: "" };
    const withNationalities = base.nationalities ? base : { ...base, nationalities: base.nationality ? [base.nationality] : [] };
    setForm({ ...emptyStudentForm, ...withNationalities });
    setFormError("");
    setShowForm(true);
  };

  const saveStudent = () => {
    if (!form.firstName.trim()) {
      setFormError("Please enter a first name before saving.");
      return;
    }
    const record = { ...form, name: fullName(form) };
    if (editingId) {
      persist({ ...data, students: data.students.map((s) => (s.id === editingId ? { ...s, ...record } : s)) });
    } else {
      const existingIdNumbers = data.students.map((s) => s.studentIdNumber).filter(Boolean);
      const studentIdNumber = nextStudentIdNumber(existingIdNumbers);
      persist({ ...data, students: [...data.students, { id: uid(), studentIdNumber, ...record }] });
      setActiveGrade(null);
    }
    setForm(emptyStudentForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeStudent = (id) => {
    persist({ ...data, students: data.students.filter((s) => s.id !== id) });
  };

  const editingStudent = data.students.find((s) => s.id === editingId);
  const total = visibleStudents.length;
  const recentStudents = [...visibleStudents].sort((a, b) => (b.studentIdNumber || "").localeCompare(a.studentIdNumber || "")).slice(0, 6);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((s) => {
      if (!groups[s.grade]) groups[s.grade] = [];
      groups[s.grade].push(s);
    });
    return GRADES.filter((g) => groups[g]).map((g) => ({ grade: g, students: groups[g] }));
  }, [filtered]);

  const renderStudentCard = (s) => (
    <div key={s.id} className={`bsf-card bsf-student ${canEditStudents ? "bsf-clickable" : ""}`} onClick={() => openEdit(s)}>
      <StudentThumb photo={s.photo} />
      <div className="bsf-student-info">
        <strong>{s.name}</strong>
        <p className="bsf-muted">{(s.nationalities && s.nationalities.length) ? s.nationalities.join(" - ") : (s.nationality || "")}{s.studentIdNumber ? `${(s.nationalities?.length || s.nationality) ? " · " : ""}ID ${s.studentIdNumber}` : ""}</p>
        {s.guardian1Name && <p className="bsf-muted">{s.guardian1Name}{s.guardian1Phone ? ` · ${s.guardian1Phone}` : ""}</p>}
        {s.allergies && <span className="bsf-tag bsf-tag-alert">Allergy: {s.allergies}</span>}
      </div>
      <div className="bsf-student-actions">
        <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); setFamilyViewId(s.id); }} aria-label="Family view"><UserCheck size={16} /></button>
        {canEditStudents && <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeStudent(s.id); }} aria-label="Remove"><Trash2 size={16} /></button>}
      </div>
    </div>
  );

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Students</p>
        <h1>{total} student{total === 1 ? "" : "s"} enrolled</h1>
        {recentStudents.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <AvatarStack students={recentStudents} />
          </div>
        )}
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        {canEditStudents && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="bsf-btn bsf-btn-ghost" onClick={() => { setBulkError(""); setBulkSuccess(""); setShowBulkAdd(true); }}>Add many</button>
            <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>
          </div>
        )}
      </div>

      <section className="bsf-card bsf-stairs-card">
        <h2>{activeGrade ? `Showing ${activeGrade}` : "Tap a grade to filter"}</h2>
        <EnrollmentStairs counts={counts} activeGrade={activeGrade} onSelect={setActiveGrade} />
      </section>

      {filtered.length === 0 && <p className="bsf-empty">No students in this view yet.</p>}

      {activeGrade
        ? <section className="bsf-list">{filtered.map(renderStudentCard)}</section>
        : grouped.map(({ grade, students }) => (
            <section key={grade} className="bsf-list">
              <p className="bsf-group-label">{grade} · {students.length} student{students.length === 1 ? "" : "s"}</p>
              {students.map(renderStudentCard)}
            </section>
          ))
      }

      {showForm && canEditStudents && (
        <Modal title={editingId ? "Edit student" : "Add student"} onClose={() => setShowForm(false)}>
          {editingId && editingStudent && (
            <AccountSetupHelper student={editingStudent} />
          )}
          <h3 className="bsf-subheading">Basic info</h3>
          <Field label="First name">
            <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" />
          </Field>
          <Field label="Middle name">
            <input value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} placeholder="Optional" />
          </Field>
          <Field label="Last name">
            <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" />
          </Field>
          <Field label="Grade">
            <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Photo">
            <StudentPhotoField photo={form.photo} onChange={(photo) => setForm({ ...form, photo })} />
          </Field>
          <div className="bsf-two-col">
            <Field label="Date of birth">
              <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            </Field>
            <Field label="Gender">
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Nationality">
            <div className="bsf-chiprow">
              {(form.nationalities || []).map((n) => (
                <span key={n} className="bsf-chip bsf-editable-chip">
                  {n}
                  <button type="button" onClick={() => setForm({ ...form, nationalities: form.nationalities.filter((x) => x !== n) })} aria-label={`Remove ${n}`}>×</button>
                </span>
              ))}
            </div>
            <select
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val && !form.nationalities.includes(val)) {
                  setForm({ ...form, nationalities: [...form.nationalities, val] });
                }
              }}
            >
              <option value="">Add a nationality</option>
              {COUNTRIES.filter((c) => !(form.nationalities || []).includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Guardian 1</h3>
          <Field label="Name">
            <input value={form.guardian1Name} onChange={(e) => setForm({ ...form, guardian1Name: e.target.value })} />
          </Field>
          <div className="bsf-two-col">
            <Field label="Relationship">
              <input value={form.guardian1Relationship} onChange={(e) => setForm({ ...form, guardian1Relationship: e.target.value })} placeholder="e.g. Mother" />
            </Field>
            <Field label="Phone">
              <input value={form.guardian1Phone} onChange={(e) => setForm({ ...form, guardian1Phone: e.target.value })} placeholder="Phone or WhatsApp" />
            </Field>
          </div>
          <Field label="Email">
            <input value={form.guardian1Email} onChange={(e) => setForm({ ...form, guardian1Email: e.target.value })} />
          </Field>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Guardian 2 (optional)</h3>
          <Field label="Name">
            <input value={form.guardian2Name} onChange={(e) => setForm({ ...form, guardian2Name: e.target.value })} />
          </Field>
          <div className="bsf-two-col">
            <Field label="Relationship">
              <input value={form.guardian2Relationship} onChange={(e) => setForm({ ...form, guardian2Relationship: e.target.value })} placeholder="e.g. Father" />
            </Field>
            <Field label="Phone">
              <input value={form.guardian2Phone} onChange={(e) => setForm({ ...form, guardian2Phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Email">
            <input value={form.guardian2Email} onChange={(e) => setForm({ ...form, guardian2Email: e.target.value })} />
          </Field>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Health &amp; safety</h3>
          <Field label="Allergies">
            <textarea rows={2} value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder="Leave blank if none" />
          </Field>
          <Field label="Medical conditions">
            <textarea rows={2} value={form.medicalConditions} onChange={(e) => setForm({ ...form, medicalConditions: e.target.value })} placeholder="Leave blank if none" />
          </Field>
          <Field label="Emergency contact name">
            <input value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} placeholder="If different from guardians" />
          </Field>
          <div className="bsf-two-col">
            <Field label="Relationship">
              <input value={form.emergencyContactRelationship} onChange={(e) => setForm({ ...form, emergencyContactRelationship: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} />
            </Field>
          </div>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Enrollment</h3>
          <Field label="Enrollment date">
            <input type="date" value={form.enrollmentDate} onChange={(e) => setForm({ ...form, enrollmentDate: e.target.value })} />
          </Field>
          <Field label="Previous school">
            <input value={form.previousSchool} onChange={(e) => setForm({ ...form, previousSchool: e.target.value })} placeholder="Optional" />
          </Field>
          <Field label="Home address">
            <textarea rows={2} value={form.homeAddress} onChange={(e) => setForm({ ...form, homeAddress: e.target.value })} />
          </Field>

          {editingId && editingStudent && (
            <>
              <hr className="bsf-divider" />
              <StudentMessages student={editingStudent} data={data} persist={persist} />
            </>
          )}

          <button className="bsf-btn bsf-btn-block" onClick={saveStudent}>{editingId ? "Save changes" : "Save student"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {familyViewStudent && (
        <FamilyViewModal student={familyViewStudent} data={data} onClose={() => setFamilyViewId(null)} />
      )}

      {showBulkAdd && canEditStudents && (
        <Modal title="Add many students at once" onClose={() => setShowBulkAdd(false)}>
          <p className="bsf-muted" style={{ marginBottom: 8 }}>
            Paste one student per line, in this format:
          </p>
          <p className="bsf-inlinenote">
            <code>First Name | Last Name | Grade | Guardian Name | Guardian Phone | Allergies</code>
            <br /><br />
            Guardian Phone and Allergies can be left blank. Grade must be written exactly like:
            <br />
            <code>{GRADES.join(", ")}</code>
            <br /><br />
            Example:
            <br />
            <code>Amara | Kone | Grade 2 | Fatou Kone | 0708112233 |</code>
            <br />
            <code>Yannick | Diallo | Grade 4 | Ibrahim Diallo | 0555221100 | Peanuts</code>
          </p>
          <Field label="Paste students here">
            <textarea rows={8} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="One student per line" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={importBulkStudents}>Import students</button>
          {bulkError && <p className="bsf-formerror">{bulkError}</p>}
          {bulkSuccess && <p className="bsf-muted" style={{ marginTop: 8 }}>{bulkSuccess}</p>}
        </Modal>
      )}
    </div>
  );
}

function ClassesTab({ data, persist, profile }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [studentIds, setStudentIds] = useState([]);
  const [formError, setFormError] = useState("");

  const isTeacherRole = profile?.role === "teacher" || profile?.role === "learning_assistant";
  const myAssignedGrades = profile?.grades_assigned || [];

  const allClasses = data.classes || [];
  // Teachers and learning assistants only see classes that include at least one
  // student in a grade they actually support, and can't change enrollment or
  // class membership, that stays an admin decision.
  const classes = isTeacherRole
    ? allClasses.filter((c) =>
        (c.studentIds || []).some((id) => {
          const s = data.students.find((st) => st.id === id);
          return s && myAssignedGrades.includes(s.grade);
        })
      )
    : allClasses;

  const sortedStudents = [...data.students].sort((a, b) => {
    const gi = (s) => GRADES.indexOf(s.grade);
    return gi(a) - gi(b) || a.name.localeCompare(b.name);
  });

  const openAdd = () => {
    setEditingId(null);
    setName("");
    setStudentIds([]);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (cls) => {
    setEditingId(cls.id);
    setName(cls.name);
    setStudentIds(cls.studentIds || []);
    setFormError("");
    setShowForm(true);
  };

  const toggleStudent = (id) => {
    setStudentIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const saveClass = () => {
    if (!name.trim()) {
      setFormError("Please enter a class name before saving.");
      return;
    }
    if (editingId) {
      persist({ ...data, classes: classes.map((c) => (c.id === editingId ? { ...c, name, studentIds } : c)) });
    } else {
      persist({ ...data, classes: [...classes, { id: uid(), name, studentIds }] });
    }
    setShowForm(false);
  };

  const removeClass = (id) => persist({ ...data, classes: classes.filter((c) => c.id !== id) });

  const gradeSpan = (cls) => {
    const grades = [...new Set((cls.studentIds || []).map((id) => data.students.find((s) => s.id === id)?.grade).filter(Boolean))];
    return grades.sort((a, b) => GRADES.indexOf(a) - GRADES.indexOf(b)).join(", ");
  };

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Classes</p>
        <h1>{classes.length} class{classes.length === 1 ? "" : "es"}</h1>
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        {!isTeacherRole && <button className="bsf-btn" onClick={openAdd} disabled={data.students.length === 0}><Plus size={16} /> Add</button>}
      </div>
      {data.students.length === 0 && !isTeacherRole && <p className="bsf-empty">Add students first, then group them into classes here.</p>}

      <section className="bsf-list">
        {classes.length === 0 && data.students.length > 0 && <p className="bsf-empty">No classes yet.{!isTeacherRole && " Group students by homeroom, even across grade levels."}</p>}
        {classes.map((c) => {
          const rosterIds = isTeacherRole
            ? (c.studentIds || []).filter((id) => {
                const s = data.students.find((st) => st.id === id);
                return s && myAssignedGrades.includes(s.grade);
              })
            : (c.studentIds || []);
          return (
            <div key={c.id} className={`bsf-card bsf-student ${isTeacherRole ? "" : "bsf-clickable"}`} onClick={() => { if (!isTeacherRole) openEdit(c); }}>
              <div>
                <strong>{c.name}</strong>
                <p className="bsf-muted">{gradeSpan(c) || "No grades yet"} · {rosterIds.length} student{rosterIds.length === 1 ? "" : "s"}</p>
                {rosterIds.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <AvatarStack students={rosterIds.map((id) => data.students.find((st) => st.id === id)).filter(Boolean)} />
                  </div>
                )}
              </div>
              {!isTeacherRole && (
                <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeClass(c.id); }} aria-label="Remove">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          );
        })}
      </section>

      {showForm && !isTeacherRole && (
        <Modal title={editingId ? "Edit class" : "New class"} onClose={() => setShowForm(false)}>
          <Field label="Class name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pre-Nursery / PreK, Grade 1 / 2" />
          </Field>
          <Field label="Students">
            <div className="bsf-checklist">
              {sortedStudents.map((s) => (
                <label key={s.id} className="bsf-checklist-row">
                  <input type="checkbox" checked={studentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                  <span>{s.name} <span className="bsf-muted">· {s.grade}</span></span>
                </label>
              ))}
            </div>
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveClass}>Save class</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

function PortfolioTab({ data, persist, profile }) {
  const { t } = useLanguage();
  const isParent = profile?.role === "parent";
  const isStudent = profile?.role === "student";
  const isStaffScoped = profile?.role === "teacher" || profile?.role === "learning_assistant";
  const linkedIds = profile?.student_ids || [];
  const myAssignedGrades = profile?.grades_assigned || [];
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ studentId: "", tag: TAGS[0], note: "", author: "teacher", files: [] });
  const [formError, setFormError] = useState("");

  const myStudentId = isStudent ? linkedIds[0] : null;
  const myStudent = myStudentId ? data.students.find((s) => s.id === myStudentId) : null;

  const visibleStudentIds = isStaffScoped
    ? data.students.filter((s) => myAssignedGrades.includes(s.grade)).map((s) => s.id)
    : null;

  const entries = [...data.portfolio]
    .filter((p) => !isParent || linkedIds.includes(p.studentId))
    .filter((p) => !isStudent || p.studentId === myStudentId)
    .filter((p) => !visibleStudentIds || visibleStudentIds.includes(p.studentId))
    .sort((a, b) => b.date.localeCompare(a.date));

  const openAddAsStudent = () => {
    if (!myStudent) return;
    setForm({ studentId: myStudent.id, tag: TAGS[0], note: "", author: "student", files: [] });
    setFormError("");
    setShowAdd(true);
  };

  const addEntry = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError(t("portfolio.errorChooseStudent"));
      return;
    }
    if (!form.note.trim() && form.files.length === 0) {
      setFormError(isStudent ? "Write something or add a photo before saving." : t("portfolio.errorAddNote"));
      return;
    }
    const entry = {
      id: uid(),
      studentId: student.id,
      studentName: student.name,
      tag: form.tag,
      note: form.note,
      author: isStudent ? "student" : form.author,
      files: form.files,
      date: new Date().toISOString().slice(0, 10)
    };
    persist({ ...data, portfolio: [...data.portfolio, entry] });
    setForm({ studentId: "", tag: TAGS[0], note: "", author: "teacher", files: [] });
    setFormError("");
    setShowAdd(false);
  };

  const removeEntry = (id) => persist({ ...data, portfolio: data.portfolio.filter((p) => p.id !== id) });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentEntries = entries.filter((p) => p.date >= sevenDaysAgo);
  const earlierEntries = entries.filter((p) => p.date < sevenDaysAgo);

  const renderEntry = (p) => {
    const student = data.students.find((s) => s.id === p.studentId);
    const canEditThisEntry = !isParent && (!isStudent || p.author === "student");
    const reactions = p.reactions || [];
    const iReacted = profile?.id && reactions.some((r) => r.profileId === profile.id);
    const toggleReaction = () => {
      if (!profile?.id) return;
      const nextReactions = iReacted
        ? reactions.filter((r) => r.profileId !== profile.id)
        : [...reactions, { profileId: profile.id, name: profile.full_name || "Someone" }];
      persist({ ...data, portfolio: data.portfolio.map((e) => (e.id === p.id ? { ...e, reactions: nextReactions } : e)) });
    };
    return (
      <div key={p.id} className="bsf-card bsf-portfolio-entry">
        <StudentThumb photo={student?.photo} />
        <div style={{ flex: 1 }}>
          <div className="bsf-row-head">
            <strong>{p.studentName}</strong>
            <span className={`bsf-author-badge ${p.author === "student" ? "student" : "teacher"}`}>
              {p.author === "student" ? t("portfolio.studentReflection") : t("portfolio.teacherNote")}
            </span>
          </div>
          <div className="bsf-row-head" style={{ marginTop: 2 }}>
            <span className="bsf-tag">{t(`tag.${p.tag}`)}</span>
            <span className="bsf-muted">{p.date}</span>
          </div>
          <p style={{ marginTop: 8 }}>{p.note}</p>
          {(!isParent || (p.files || []).length > 0) && (
            <AttachmentField
              folder="portfolio"
              files={p.files || []}
              onChange={(files) =>
                persist({ ...data, portfolio: data.portfolio.map((e) => (e.id === p.id ? { ...e, files } : e)) })
              }
              readOnly={isParent}
            />
          )}
          <div className="bsf-reactionrow">
            <button type="button" className={`bsf-reactbtn ${iReacted ? "active" : ""}`} onClick={toggleReaction}>
              <span>{iReacted ? "❤️" : "🤍"}</span>
              {reactions.length > 0 && <span>{reactions.length}</span>}
            </button>
            {reactions.length > 0 && (
              <span className="bsf-muted bsf-reactionnames">
                {reactions.slice(0, 3).map((r) => r.name.split(" ")[0]).join(", ")}{reactions.length > 3 ? ` and ${reactions.length - 3} more` : ""}
              </span>
            )}
          </div>
        </div>
        {canEditThisEntry && <button className="bsf-iconbtn" onClick={() => removeEntry(p.id)} aria-label={t("common.remove")}><Trash2 size={16} /></button>}
      </div>
    );
  };

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        {isStudent && myStudent ? (
          <>
            <p className="bsf-eyebrow">{myStudent.grade}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
              <StudentThumb photo={myStudent.photo} />
              <div>
                <h1 style={{ marginBottom: 2 }}>Welcome back, {myStudent.firstName || myStudent.name.split(" ")[0]}</h1>
                <p className="bsf-hero-sub" style={{ margin: 0 }}>This is your space, your work, your voice.</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="bsf-eyebrow">{t("portfolio.title")}</p>
            <h1>{entries.length} entr{entries.length === 1 ? "y" : "ies"}</h1>
          </>
        )}
        {recentEntries.length > 0 && <p className="bsf-hero-sub" style={{ marginTop: 10 }}>{recentEntries.length} added in the last 7 days</p>}
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        {!isParent && !isStudent && <button className="bsf-btn" onClick={() => { setFormError(""); setShowAdd(true); }} disabled={data.students.length === 0}><Plus size={16} /> {t("common.add")}</button>}
        {isStudent && myStudent && <button className="bsf-btn" onClick={openAddAsStudent}><Plus size={16} /> Add my reflection</button>}
      </div>

      {data.students.length === 0 && !isParent && !isStudent && <p className="bsf-empty">{t("portfolio.emptyStudents")}</p>}
      {isParent && entries.length === 0 && <p className="bsf-empty">No portfolio entries yet for your child.</p>}
      {isStudent && !myStudent && <p className="bsf-empty">Your account isn't linked to a student record yet. Ask your teacher or admin.</p>}
      {isStudent && myStudent && entries.length === 0 && <p className="bsf-empty">No entries yet, tap "Add my reflection" to share your first one.</p>}

      {recentEntries.length > 0 && (
        <section className="bsf-list">
          <p className="bsf-group-label">This week</p>
          {recentEntries.map(renderEntry)}
        </section>
      )}
      {earlierEntries.length > 0 && (
        <section className="bsf-list">
          <p className="bsf-group-label">Earlier</p>
          {earlierEntries.map(renderEntry)}
        </section>
      )}

      {showAdd && (
        <Modal title={isStudent ? "My reflection" : t("portfolio.newEntry")} onClose={() => setShowAdd(false)}>
          {!isStudent && (
            <>
              <Field label={t("portfolio.entryType")}>
                <div className="bsf-chiprow">
                  <button
                    type="button"
                    className={`bsf-chip ${form.author === "teacher" ? "active" : ""}`}
                    onClick={() => setForm({ ...form, author: "teacher" })}
                  >
                    {t("portfolio.teacherNote")}
                  </button>
                  <button
                    type="button"
                    className={`bsf-chip ${form.author === "student" ? "active" : ""}`}
                    onClick={() => setForm({ ...form, author: "student" })}
                  >
                    {t("portfolio.studentReflection")}
                  </button>
                </div>
              </Field>
              <Field label={t("portfolio.student")}>
                <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                  <option value="">{t("portfolio.chooseStudent")}</option>
                  {(isStaffScoped ? data.students.filter((s) => myAssignedGrades.includes(s.grade)) : data.students).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
                </select>
              </Field>
            </>
          )}
          <Field label={t("portfolio.focusArea")}>
            <select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}>
              {TAGS.map((tg) => <option key={tg} value={tg}>{t(`tag.${tg}`)}</option>)}
            </select>
          </Field>
          <Field label={isStudent ? "Write about it (optional if you're adding a photo)" : (form.author === "student" ? t("portfolio.whatStudentWrote") : t("portfolio.whatDidTheyDo"))}>
            <textarea
              rows={4}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={isStudent ? "Tell us about your work..." : (form.author === "student" ? t("portfolio.placeholderStudentWords") : t("portfolio.placeholderLearningMoment"))}
            />
          </Field>
          <Field label={isStudent ? "Add a photo" : t("portfolio.attachmentsOptional")}>
            <AttachmentField folder="portfolio" files={form.files} onChange={(files) => setForm({ ...form, files })} />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={addEntry}>{isStudent ? "Save my reflection" : t("portfolio.saveEntry")}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

const emptyPlanForm = {
  grades: [],
  theme: "",
  subject: "",
  title: "",
  centralIdea: "",
  keyConcepts: "",
  linesOfInquiry: "",
  keyVocabulary: "",
  learningOutcomes: "",
  atlSkills: "",
  learnerProfileFocus: "",
  differentiation: "",
  resources: "",
  standardIds: [],
  startDate: "",
  endDate: "",
  lessonPlanText: "",
  lessonPlanLink: "",
  lessonPlanFiles: [],
  assessmentFormative: "",
  evidenceLink: "",
  evidenceNotes: "",
  evidenceFiles: [],
  assessmentSummative: "",
  studentAction: "",
  reflection: "",
  comments: []
};

function PlanDetailModal({ plan, data, onClose, onUpdate }) {
  const [lessonPlanText, setLessonPlanText] = useState(plan.lessonPlanText || "");
  const [lessonPlanLink, setLessonPlanLink] = useState(plan.lessonPlanLink || "");
  const [assessmentFormative, setAssessmentFormative] = useState(plan.assessmentFormative || "");
  const [evidenceLink, setEvidenceLink] = useState(plan.evidenceLink || "");
  const [evidenceNotes, setEvidenceNotes] = useState(plan.evidenceNotes || "");
  const [assessmentSummative, setAssessmentSummative] = useState(plan.assessmentSummative || "");
  const [studentAction, setStudentAction] = useState(plan.studentAction || "");
  const [reflection, setReflection] = useState(plan.reflection || "");
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentText, setCommentText] = useState("");

  const standards = data?.standards || [];
  const standardIds = plan.standardIds || [];

  const saveField = (patch) => onUpdate(plan.id, patch);

  const toggleStandard = (id) => {
    const next = standardIds.includes(id) ? standardIds.filter((x) => x !== id) : [...standardIds, id];
    saveField({ standardIds: next });
  };

  const addComment = () => {
    if (!commentText.trim()) return;
    const comment = {
      id: uid(),
      author: commentAuthor.trim() || "Team member",
      text: commentText.trim(),
      date: new Date().toISOString().slice(0, 10)
    };
    onUpdate(plan.id, { comments: [...(plan.comments || []), comment] });
    setCommentText("");
  };

  const removeComment = (id) => {
    onUpdate(plan.id, { comments: (plan.comments || []).filter((c) => c.id !== id) });
  };

  return (
    <Modal title={plan.title} onClose={onClose}>
      <div className="bsf-row-head">
        <span className="bsf-tag">
          {plan.grades && plan.grades.length === GRADES.length ? "All grades" : (plan.grades || []).join(", ") || plan.grade}
        </span>
        {plan.subject && <span className="bsf-muted">{plan.subject}</span>}
      </div>
      {plan.theme && <p className="bsf-muted">Theme: {plan.theme}</p>}
      {plan.centralIdea && <p>{plan.centralIdea}</p>}
      {plan.keyConcepts && <p className="bsf-muted">Key concepts: {plan.keyConcepts}</p>}
      {plan.linesOfInquiry && <p className="bsf-loi">{plan.linesOfInquiry}</p>}

      <hr className="bsf-divider" />

      <Field label="Standards addressed">
        {standards.length === 0 ? (
          <p className="bsf-empty">No standards in your library yet. Add some from Assessment → Standards.</p>
        ) : (
          <div className="bsf-chiprow">
            {standards.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`bsf-chip ${standardIds.includes(s.id) ? "active" : ""}`}
                onClick={() => toggleStandard(s.id)}
              >
                {s.code || s.description.slice(0, 24)}
              </button>
            ))}
          </div>
        )}
      </Field>

      <hr className="bsf-divider" />

      <Field label="Lesson plan notes">
        <textarea
          rows={5}
          value={lessonPlanText}
          onChange={(e) => setLessonPlanText(e.target.value)}
          onBlur={() => saveField({ lessonPlanText })}
          placeholder="Paste or write the lesson plan content here"
        />
      </Field>
      <Field label="Lesson plan link (optional)">
        <input
          value={lessonPlanLink}
          onChange={(e) => setLessonPlanLink(e.target.value)}
          onBlur={() => saveField({ lessonPlanLink })}
          placeholder="Link to a doc, if it lives elsewhere"
        />
      </Field>
      <Field label="Lesson plan attachments">
        <AttachmentField
          folder="planning"
          files={plan.lessonPlanFiles}
          onChange={(files) => saveField({ lessonPlanFiles: files })}
        />
      </Field>
      <Field label="Assessment (formative)">
        <textarea
          rows={3}
          value={assessmentFormative}
          onChange={(e) => setAssessmentFormative(e.target.value)}
          onBlur={() => saveField({ assessmentFormative })}
          placeholder="Quick checks along the way to see how understanding is developing"
        />
      </Field>

      <hr className="bsf-divider" />

      <Field label="Evidence link">
        <input
          value={evidenceLink}
          onChange={(e) => setEvidenceLink(e.target.value)}
          onBlur={() => saveField({ evidenceLink })}
          placeholder="Link to photos, documents, or student work"
        />
      </Field>
      <Field label="Evidence notes">
        <textarea
          rows={3}
          value={evidenceNotes}
          onChange={(e) => setEvidenceNotes(e.target.value)}
          onBlur={() => saveField({ evidenceNotes })}
          placeholder="Describe what the evidence shows"
        />
      </Field>
      <Field label="Evidence attachments">
        <AttachmentField
          folder="planning"
          files={plan.evidenceFiles}
          onChange={(files) => saveField({ evidenceFiles: files })}
        />
      </Field>
      <Field label="Assessment (summative)">
        <textarea
          rows={3}
          value={assessmentSummative}
          onChange={(e) => setAssessmentSummative(e.target.value)}
          onBlur={() => saveField({ assessmentSummative })}
          placeholder="The final task or product that shows understanding"
        />
      </Field>

      <hr className="bsf-divider" />

      <Field label="Student action">
        <textarea
          rows={3}
          value={studentAction}
          onChange={(e) => setStudentAction(e.target.value)}
          onBlur={() => saveField({ studentAction })}
          placeholder="How learning connects to something students do or change beyond the classroom"
        />
      </Field>

      <Field label="Reflection">
        <textarea
          rows={4}
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          onBlur={() => saveField({ reflection })}
          placeholder="What worked, what would you change next time"
        />
      </Field>

      <hr className="bsf-divider" />

      <h3 className="bsf-subheading">Team notes</h3>
      <div className="bsf-comments">
        {(plan.comments || []).length === 0 && <p className="bsf-empty">No notes yet. Teachers can leave one below.</p>}
        {(plan.comments || []).map((c) => (
          <div key={c.id} className="bsf-comment">
            <div className="bsf-row-head">
              <strong>{c.author}</strong>
              <span className="bsf-muted">{c.date}</span>
            </div>
            <p>{c.text}</p>
            <button className="bsf-textbtn" onClick={() => removeComment(c.id)}>Remove</button>
          </div>
        ))}
      </div>
      <Field label="Your name">
        <input value={commentAuthor} onChange={(e) => setCommentAuthor(e.target.value)} placeholder="e.g. Myriam" />
      </Field>
      <Field label="Add a note">
        <textarea rows={2} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Share a thought with the team" />
      </Field>
      <button className="bsf-btn bsf-btn-block" onClick={addComment}>Post note</button>
    </Modal>
  );
}

function PlanningTab({ data, persist }) {
  const [curriculumView, setCurriculumView] = useState("documents");
  const [showAdd, setShowAdd] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(emptyPlanForm);
  const [formError, setFormError] = useState("");
  const [gradeFilter, setGradeFilter] = useState(null);

  const [showDocForm, setShowDocForm] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [docForm, setDocForm] = useState({ title: "", subject: CURRICULUM_SUBJECTS[0], description: "", files: [] });
  const [docFormError, setDocFormError] = useState("");
  const [docSubjectFilter, setDocSubjectFilter] = useState(null);

  const documents = [...(data.curriculumDocuments || [])].sort((a, b) => a.title.localeCompare(b.title));
  const filteredDocs = docSubjectFilter ? documents.filter((d) => d.subject === docSubjectFilter) : documents;

  const openAddDoc = () => {
    setEditingDocId(null);
    setDocForm({ title: "", subject: CURRICULUM_SUBJECTS[0], description: "", files: [] });
    setDocFormError("");
    setShowDocForm(true);
  };

  const openEditDoc = (d) => {
    setEditingDocId(d.id);
    setDocForm({ title: d.title, subject: d.subject, description: d.description || "", files: d.files || [] });
    setDocFormError("");
    setShowDocForm(true);
  };

  const saveDoc = () => {
    if (!docForm.title.trim()) {
      setDocFormError("Please give this document a title.");
      return;
    }
    if (editingDocId) {
      persist({ ...data, curriculumDocuments: (data.curriculumDocuments || []).map((d) => (d.id === editingDocId ? { ...d, ...docForm } : d)) });
    } else {
      persist({ ...data, curriculumDocuments: [...(data.curriculumDocuments || []), { id: uid(), date: todayStr(), ...docForm }] });
    }
    setShowDocForm(false);
    setDocFormError("");
  };

  const removeDoc = (id) => persist({ ...data, curriculumDocuments: (data.curriculumDocuments || []).filter((d) => d.id !== id) });

  const plans = [...data.plans].sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  const filtered = gradeFilter
    ? plans.filter((p) => (p.grades || []).includes(gradeFilter))
    : plans;
  const allSelected = form.grades.length === GRADES.length;
  const detailPlan = data.plans.find((p) => p.id === detailId);
  const standards = data.standards || [];

  const toggleGrade = (g) => {
    setForm((f) => ({
      ...f,
      grades: f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g]
    }));
  };

  const toggleStandard = (id) => {
    setForm((f) => ({
      ...f,
      standardIds: f.standardIds.includes(id) ? f.standardIds.filter((x) => x !== id) : [...f.standardIds, id]
    }));
  };

  const toggleAllGrades = () => {
    setForm((f) => ({ ...f, grades: allSelected ? [] : [...GRADES] }));
  };

  const applyTemplate = () => {
    setForm((f) => ({
      ...f,
      centralIdea: f.centralIdea || PLAN_TEMPLATE.centralIdea,
      keyConcepts: f.keyConcepts || PLAN_TEMPLATE.keyConcepts,
      linesOfInquiry: f.linesOfInquiry || PLAN_TEMPLATE.linesOfInquiry
    }));
  };

  const addPlan = () => {
    if (!form.title.trim() || form.grades.length === 0) {
      setFormError("Please add a title and choose at least one grade.");
      return;
    }
    persist({ ...data, plans: [...data.plans, { id: uid(), ...form }] });
    setForm(emptyPlanForm);
    setFormError("");
    setShowAdd(false);
  };

  const removePlan = (id) => persist({ ...data, plans: data.plans.filter((p) => p.id !== id) });

  const updatePlan = (id, patch) => {
    persist({ ...data, plans: data.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Curriculum</p>
        <h1>{documents.length} document{documents.length === 1 ? "" : "s"} · {data.plans.length} unit plan{data.plans.length === 1 ? "" : "s"}</h1>
      </div>

      <div className="bsf-tiletoggle">
        <button className={`bsf-tiletoggle-btn ${curriculumView === "documents" ? "active" : ""}`} onClick={() => setCurriculumView("documents")}>Documents</button>
        <button className={`bsf-tiletoggle-btn ${curriculumView === "units" ? "active" : ""}`} onClick={() => setCurriculumView("units")}>Unit Planning</button>
      </div>

      {curriculumView === "documents" && (
        <>
          <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
            <span />
            <button className="bsf-btn" onClick={openAddDoc}><Plus size={16} /> Add document</button>
          </div>

          <section className="bsf-card">
            <h2>Filter by subject</h2>
            <div className="bsf-chiprow">
              <button className={`bsf-chip ${docSubjectFilter === null ? "active" : ""}`} onClick={() => setDocSubjectFilter(null)}>All</button>
              {[
                ...CURRICULUM_SUBJECTS,
                // Only show a retired subject if a document is actually still filed under it.
                ...RETIRED_CURRICULUM_SUBJECTS.filter((r) => documents.some((d) => d.subject === r))
              ].map((s) => (
                <button key={s} className={`bsf-chip ${docSubjectFilter === s ? "active" : ""}`} onClick={() => setDocSubjectFilter(s)}>{s}</button>
              ))}
            </div>
          </section>

          <section className="bsf-list">
            {filteredDocs.length === 0 && <p className="bsf-empty">No curriculum documents added yet, start with your ELA handbook.</p>}
            {filteredDocs.map((d) => (
              <div key={d.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEditDoc(d)}>
                <div>
                  <span className="bsf-tag">{d.subject}</span>
                  <strong style={{ display: "block", marginTop: 4 }}>{d.title}</strong>
                  {d.description && <p className="bsf-muted">{d.description}</p>}
                  {(d.files || []).length > 0 && <p className="bsf-muted">{d.files.length} file{d.files.length === 1 ? "" : "s"} attached</p>}
                </div>
                <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeDoc(d.id); }} aria-label="Remove"><Trash2 size={16} /></button>
              </div>
            ))}
          </section>

          {showDocForm && (
            <Modal title={editingDocId ? "Edit document" : "New curriculum document"} onClose={() => setShowDocForm(false)}>
              <Field label="Title">
                <input value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} placeholder="e.g. ELA Handbook" />
              </Field>
              <Field label="Subject">
                <select value={docForm.subject} onChange={(e) => setDocForm({ ...docForm, subject: e.target.value })}>
                  {CURRICULUM_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Description (optional)">
                <textarea rows={2} value={docForm.description} onChange={(e) => setDocForm({ ...docForm, description: e.target.value })} placeholder="What this document covers" />
              </Field>
              <Field label="File">
                <AttachmentField folder="curriculum" files={docForm.files} onChange={(files) => setDocForm({ ...docForm, files })} />
              </Field>
              <button className="bsf-btn bsf-btn-block" onClick={saveDoc}>Save document</button>
              {docFormError && <p className="bsf-formerror">{docFormError}</p>}
            </Modal>
          )}
        </>
      )}

      {curriculumView === "units" && (
        <>
      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        <button className="bsf-btn" onClick={() => setShowAdd(true)}><Plus size={16} /> Add</button>
      </div>

      <div className="bsf-chiprow">
        <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>All</button>
        {GRADES.map((g) => (
          <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{g}</button>
        ))}
      </div>

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No units planned yet.</p>}
        {filtered.map((p) => (
          <div key={p.id} className="bsf-card bsf-student bsf-clickable" onClick={() => setDetailId(p.id)}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-tag">
                  {p.grades && p.grades.length === GRADES.length
                    ? "All grades"
                    : (p.grades || []).join(", ") || p.grade}
                </span>
                {p.subject && <span className="bsf-muted">{p.subject}</span>}
              </div>
              {p.theme && <p className="bsf-muted">Theme: {p.theme}</p>}
              <strong>{p.title}</strong>
              {p.centralIdea && <p>{p.centralIdea}</p>}
              {p.keyConcepts && <p className="bsf-muted">Key concepts: {p.keyConcepts}</p>}
              {p.linesOfInquiry && <p className="bsf-loi">{p.linesOfInquiry}</p>}
              {(p.startDate || p.endDate) && <p className="bsf-muted">{p.startDate || "?"} to {p.endDate || "?"}</p>}
              <div className="bsf-chiprow bsf-status-chips">
                {p.lessonPlanText || p.lessonPlanLink || (p.lessonPlanFiles || []).length > 0 ? <span className="bsf-minitag">Lesson plan</span> : null}
                {p.evidenceLink || p.evidenceNotes || (p.evidenceFiles || []).length > 0 ? <span className="bsf-minitag">Evidence</span> : null}
                {p.reflection ? <span className="bsf-minitag">Reflection</span> : null}
                {(p.standardIds || []).length > 0 ? <span className="bsf-minitag">{p.standardIds.length} standard{p.standardIds.length === 1 ? "" : "s"}</span> : null}
                {(p.comments || []).length > 0 ? <span className="bsf-minitag">{p.comments.length} note{p.comments.length === 1 ? "" : "s"}</span> : null}
              </div>
            </div>
            <button
              className="bsf-iconbtn"
              onClick={(e) => { e.stopPropagation(); removePlan(p.id); }}
              aria-label="Remove"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </section>
        </>
      )}

      {showAdd && (
        <Modal title="New unit plan" onClose={() => setShowAdd(false)}>
          <Field label="Grades covered">
            <div className="bsf-chiprow">
              <button className={`bsf-chip ${allSelected ? "active" : ""}`} onClick={toggleAllGrades}>All grades</button>
              {GRADES.map((g) => (
                <button
                  key={g}
                  className={`bsf-chip ${form.grades.includes(g) ? "active" : ""}`}
                  onClick={() => toggleGrade(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Transdisciplinary theme">
            <select value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })}>
              <option value="">No theme</option>
              {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Subject">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Science, Literacy, or Whole school" />
          </Field>
          <Field label="Unit title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. How the World Works" />
          </Field>
          <Field label="Attachments">
            <AttachmentField
              folder="planning"
              files={form.lessonPlanFiles}
              onChange={(files) => setForm({ ...form, lessonPlanFiles: files })}
            />
          </Field>

          <button type="button" className="bsf-templatebtn" onClick={applyTemplate}>Fill in unit plan template</button>

          <Field label="Central idea">
            <textarea rows={3} value={form.centralIdea} onChange={(e) => setForm({ ...form, centralIdea: e.target.value })} placeholder="What big idea drives this unit" />
          </Field>
          <Field label="Key concepts">
            <input value={form.keyConcepts} onChange={(e) => setForm({ ...form, keyConcepts: e.target.value })} placeholder="e.g. Form, Change, Connection" />
          </Field>
          <Field label="Lines of inquiry">
            <textarea rows={3} value={form.linesOfInquiry} onChange={(e) => setForm({ ...form, linesOfInquiry: e.target.value })} placeholder="One idea per line" />
          </Field>
          <Field label="Key vocabulary">
            <textarea rows={2} value={form.keyVocabulary} onChange={(e) => setForm({ ...form, keyVocabulary: e.target.value })} placeholder="Important words students should know by the end" />
          </Field>
          <Field label="Learning outcomes">
            <textarea rows={3} value={form.learningOutcomes} onChange={(e) => setForm({ ...form, learningOutcomes: e.target.value })} placeholder="What students should know or be able to do" />
          </Field>
          <Field label="Approaches to learning skills">
            <textarea rows={2} value={form.atlSkills} onChange={(e) => setForm({ ...form, atlSkills: e.target.value })} placeholder="e.g. Research, communication, self management" />
          </Field>
          <Field label="Learner profile focus">
            <input value={form.learnerProfileFocus} onChange={(e) => setForm({ ...form, learnerProfileFocus: e.target.value })} placeholder="e.g. Curious, caring, reflective" />
          </Field>
          <Field label="Differentiation">
            <textarea rows={3} value={form.differentiation} onChange={(e) => setForm({ ...form, differentiation: e.target.value })} placeholder="How the unit adapts for different learners" />
          </Field>
          <Field label="Resources and materials">
            <textarea rows={2} value={form.resources} onChange={(e) => setForm({ ...form, resources: e.target.value })} placeholder="Books, websites, supplies needed" />
          </Field>
          <Field label="Standards addressed (optional)">
            {standards.length === 0 ? (
              <p className="bsf-empty">No standards in your library yet. Add some from Assessment → Standards.</p>
            ) : (
              <div className="bsf-chiprow">
                {standards.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`bsf-chip ${form.standardIds.includes(s.id) ? "active" : ""}`}
                    onClick={() => toggleStandard(s.id)}
                  >
                    {s.code || s.description.slice(0, 24)}
                  </button>
                ))}
              </div>
            )}
          </Field>
          <div className="bsf-two-col">
            <Field label="Start date">
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="End date">
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
          </div>
          <Field label="Reflection">
            <textarea
              rows={4}
              value={form.reflection}
              onChange={(e) => setForm({ ...form, reflection: e.target.value })}
              placeholder="What worked, what would you change next time"
            />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={addPlan}>Save unit plan</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {detailPlan && (
        <PlanDetailModal plan={detailPlan} data={data} onClose={() => setDetailId(null)} onUpdate={updatePlan} />
      )}
    </div>
  );
}

function UpdatesTab({ data, persist }) {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const isParent = profile?.role === "parent";
  const isTeacherRole = profile?.role === "teacher" || profile?.role === "learning_assistant";
  const myAssignedGrades = profile?.grades_assigned || [];
  const linkedIds = profile?.student_ids || [];
  const myChildGrades = isParent ? [...new Set(data.students.filter((s) => linkedIds.includes(s.id)).map((s) => s.grade))] : [];

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ titleEn: "", bodyEn: "", titleFr: "", bodyFr: "", grades: [] });
  const [formError, setFormError] = useState("");
  const [translatingId, setTranslatingId] = useState(null);
  const [translateForm, setTranslateForm] = useState({ titleFr: "", bodyFr: "" });

  const allPosts = [...data.announcements].sort((a, b) => b.date.localeCompare(a.date));
  const posts = isParent
    ? allPosts.filter((a) => !a.grades || a.grades.length === 0 || a.grades.some((g) => myChildGrades.includes(g)))
    : allPosts;

  const toggleGrade = (g) => {
    setForm((f) => ({ ...f, grades: f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g] }));
  };

  const addPost = () => {
    if (!form.titleEn.trim()) {
      setFormError("Please add an English title before posting.");
      return;
    }
    if (isTeacherRole && form.grades.length === 0) {
      setFormError("Please choose at least one of your grades to send this to.");
      return;
    }
    const post = { id: uid(), ...form, date: new Date().toISOString().slice(0, 10) };
    persist({ ...data, announcements: [...data.announcements, post] });
    setForm({ titleEn: "", bodyEn: "", titleFr: "", bodyFr: "", grades: [] });
    setFormError("");
    setShowAdd(false);
  };

  const removePost = (id) => persist({ ...data, announcements: data.announcements.filter((a) => a.id !== id) });

  const openTranslate = (post) => {
    setTranslateForm({ titleFr: post.titleFr || "", bodyFr: post.bodyFr || "" });
    setTranslatingId(post.id);
  };

  const saveTranslation = () => {
    persist({
      ...data,
      announcements: data.announcements.map((a) => (a.id === translatingId ? { ...a, ...translateForm } : a))
    });
    setTranslatingId(null);
  };

  const translatingPost = data.announcements.find((a) => a.id === translatingId);

  const audienceLabel = (a) => {
    if (!a.grades || a.grades.length === 0) return "Whole school";
    return a.grades.join(", ");
  };

  const recentCount = posts.filter((a) => a.date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).length;

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Family Updates</p>
        <h1>{posts.length} post{posts.length === 1 ? "" : "s"}</h1>
        {recentCount > 0 && <p className="bsf-hero-sub">{recentCount} in the last 7 days</p>}
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        {!isParent && <button className="bsf-btn" onClick={() => { setFormError(""); setForm({ titleEn: "", bodyEn: "", titleFr: "", bodyFr: "", grades: isTeacherRole ? [] : [] }); setShowAdd(true); }}><Plus size={16} /> Post</button>}
      </div>

      <section className="bsf-list">
        {posts.length === 0 && <p className="bsf-empty">Nothing posted yet.</p>}
        {posts.map((a) => {
          if (isParent) {
            const showFrench = language === "fr" && a.titleFr;
            return (
              <div key={a.id} className="bsf-card bsf-student">
                <div>
                  <span className="bsf-muted">{a.date}</span>
                  <strong>{showFrench ? a.titleFr : a.titleEn}</strong>
                  <p>{showFrench ? a.bodyFr : a.bodyEn}</p>
                </div>
              </div>
            );
          }
          return (
            <div key={a.id} className="bsf-card bsf-student">
              <div>
                <div className="bsf-row-head">
                  <span className="bsf-muted">{a.date}</span>
                  <span className="bsf-tag">{audienceLabel(a)}</span>
                </div>
                <strong>{a.titleEn}</strong>
                <p>{a.bodyEn}</p>
                {a.titleFr && (
                  <div className="bsf-fr-block">
                    <strong>{a.titleFr}</strong>
                    <p>{a.bodyFr}</p>
                  </div>
                )}
                <button className="bsf-textbtn" onClick={() => openTranslate(a)} style={{ marginTop: 6 }}>
                  {a.titleFr ? "Edit French translation" : "Add French translation"}
                </button>
              </div>
              <button className="bsf-iconbtn" onClick={() => removePost(a.id)} aria-label="Remove"><Trash2 size={16} /></button>
            </div>
          );
        })}
      </section>

      {showAdd && (
        <Modal title="New family update" onClose={() => setShowAdd(false)}>
          <Field label={isTeacherRole ? "Send to (choose your grade or grades)" : "Send to"}>
            <div className="bsf-chiprow">
              {isTeacherRole ? (
                myAssignedGrades.length === 0 ? (
                  <p className="bsf-empty">You don't have any grades assigned yet. Ask your administrator.</p>
                ) : (
                  myAssignedGrades.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`bsf-chip ${form.grades.includes(g) ? "active" : ""}`}
                      onClick={() => toggleGrade(g)}
                    >
                      {g}
                    </button>
                  ))
                )
              ) : (
                <>
                  <button
                    type="button"
                    className={`bsf-chip ${form.grades.length === 0 ? "active" : ""}`}
                    onClick={() => setForm({ ...form, grades: [] })}
                  >
                    Whole school
                  </button>
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`bsf-chip ${form.grades.includes(g) ? "active" : ""}`}
                      onClick={() => toggleGrade(g)}
                    >
                      {g}
                    </button>
                  ))}
                </>
              )}
            </div>
          </Field>
          <Field label="Title (English)">
            <input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} />
          </Field>
          <Field label="Message (English)">
            <textarea rows={3} value={form.bodyEn} onChange={(e) => setForm({ ...form, bodyEn: e.target.value })} />
          </Field>
          <p className="bsf-muted" style={{ marginBottom: 12 }}>
            You can add the French translation afterward, once it's ready, from the post itself.
          </p>
          <button className="bsf-btn bsf-btn-block" onClick={addPost}>Publish update</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {translatingPost && (
        <Modal title="French translation" onClose={() => setTranslatingId(null)}>
          <p className="bsf-muted" style={{ marginBottom: 12 }}>
            English version: <strong>{translatingPost.titleEn}</strong>
          </p>
          <Field label="Titre (Francais)">
            <input value={translateForm.titleFr} onChange={(e) => setTranslateForm({ ...translateForm, titleFr: e.target.value })} />
          </Field>
          <Field label="Message (Francais)">
            <textarea rows={3} value={translateForm.bodyFr} onChange={(e) => setTranslateForm({ ...translateForm, bodyFr: e.target.value })} />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveTranslation}>Save translation</button>
        </Modal>
      )}
    </div>
  );
}

const STATUS_CYCLE = ["present", "absent", "late"];
const STATUS_LABEL = { present: "Present", absent: "Absent", late: "Late" };
const STATUS_COLOR = { present: "#2F7A5C", absent: "#B5473B", late: "#B8842F" };

function AttendanceTab({ data, persist, profile }) {
  const [date, setDate] = useState(todayStr());
  const isParent = profile?.role === "parent";
  const isStudent = profile?.role === "student";
  const isSelfOnly = isParent || isStudent;
  const isStaffScoped = profile?.role === "teacher" || profile?.role === "learning_assistant";
  const linkedIds = profile?.student_ids || [];
  const myAssignedGrades = profile?.grades_assigned || [];
  const myGrades = isSelfOnly
    ? [...new Set(data.students.filter((s) => linkedIds.includes(s.id)).map((s) => s.grade))]
    : isStaffScoped
    ? myAssignedGrades
    : [];
  const [activeGrade, setActiveGrade] = useState((isSelfOnly || isStaffScoped) ? (myGrades[0] || null) : GRADES[0]);

  const dayRecord = data.attendance[date] || {};
  const gradeStudents = isSelfOnly
    ? data.students.filter((s) => linkedIds.includes(s.id) && s.grade === activeGrade)
    : data.students.filter((s) => s.grade === activeGrade);

  const setStatus = (studentId, status) => {
    const nextDay = { ...dayRecord, [studentId]: status };
    persist({ ...data, attendance: { ...data.attendance, [date]: nextDay } });
  };

  const cycleStatus = (studentId) => {
    if (isSelfOnly) return;
    const current = dayRecord[studentId];
    const idx = current ? STATUS_CYCLE.indexOf(current) : -1;
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setStatus(studentId, next);
  };

  const markAllPresent = () => {
    const nextDay = { ...dayRecord };
    gradeStudents.forEach((s) => { nextDay[s.id] = "present"; });
    persist({ ...data, attendance: { ...data.attendance, [date]: nextDay } });
  };

  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, unmarked: 0 };
    gradeStudents.forEach((s) => {
      const st = dayRecord[s.id];
      if (st) counts[st] += 1; else counts.unmarked += 1;
    });
    return counts;
  }, [dayRecord, gradeStudents]);

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const isToday = date === todayStr();
  const markedTotal = summary.present + summary.absent + summary.late;

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Attendance</p>
        <h1>{dateLabel}</h1>
        {!isToday && (
          <button className="bsf-textbtn" onClick={() => setDate(todayStr())} style={{ marginTop: 2 }}>
            Jump back to today
          </button>
        )}
        <div className="bsf-attend-summary">
          <div className="bsf-attend-bignum">
            <strong>{summary.present}</strong>
            <span>present today</span>
          </div>
          {markedTotal > 0 && (
            <div className="bsf-attend-segbar">
              {summary.present > 0 && <span style={{ flex: summary.present, background: STATUS_COLOR.present }} />}
              {summary.late > 0 && <span style={{ flex: summary.late, background: STATUS_COLOR.late }} />}
              {summary.absent > 0 && <span style={{ flex: summary.absent, background: STATUS_COLOR.absent }} />}
            </div>
          )}
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bsf-dateinput" style={{ marginTop: 12 }} />
      </div>

      {(isSelfOnly || isStaffScoped) && myGrades.length > 1 && (
        <section className="bsf-card">
          <h2>Grade</h2>
          <div className="bsf-chiprow">
            {myGrades.map((g) => (
              <button key={g} className={`bsf-chip ${activeGrade === g ? "active" : ""}`} onClick={() => setActiveGrade(g)}>
                {g}
              </button>
            ))}
          </div>
        </section>
      )}

      {!isSelfOnly && !isStaffScoped && (
        <section className="bsf-card">
          <h2>Grade</h2>
          <div className="bsf-chiprow">
            {GRADES.map((g) => (
              <button key={g} className={`bsf-chip ${activeGrade === g ? "active" : ""}`} onClick={() => setActiveGrade(g)}>
                {g}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 16 }}>{activeGrade}</h2>
        {!isSelfOnly && <button className="bsf-btn" onClick={markAllPresent} disabled={gradeStudents.length === 0}>Mark all present</button>}
      </div>
      <p className="bsf-muted" style={{ margin: "6px 4px 14px" }}>
        {summary.present} present · {summary.absent} absent · {summary.late} late{!isSelfOnly ? ` · ${summary.unmarked} unmarked` : ""}
      </p>

      <section className="bsf-list">
        {gradeStudents.length === 0 && <p className="bsf-empty">{isSelfOnly ? "No attendance recorded yet." : "No students in this grade yet."}</p>}
        {gradeStudents.map((s) => {
          const status = dayRecord[s.id];
          return isSelfOnly ? (
            <div key={s.id} className="bsf-card bsf-attend-row">
              <StudentThumb photo={s.photo} />
              <span><strong>{s.name}</strong></span>
              <span
                className="bsf-status-pill"
                style={{
                  background: status ? `${STATUS_COLOR[status]}1A` : "#EEE6D2",
                  color: status ? STATUS_COLOR[status] : "#8A9698"
                }}
              >
                {status ? STATUS_LABEL[status] : "Not marked yet"}
              </span>
            </div>
          ) : (
            <button key={s.id} className="bsf-card bsf-attend-row bsf-clickable" onClick={() => cycleStatus(s.id)}>
              <StudentThumb photo={s.photo} />
              <span>
                <strong>{s.name}</strong>
              </span>
              <span
                className="bsf-status-pill"
                style={{
                  background: status ? `${STATUS_COLOR[status]}1A` : "#EEE6D2",
                  color: status ? STATUS_COLOR[status] : "#8A9698"
                }}
              >
                {status ? STATUS_LABEL[status] : "Tap to mark"}
              </span>
            </button>
          );
        })}
      </section>
    </div>
  );
}

function RubricLibraryModal({ data, persist, onClose }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [itemsText, setItemsText] = useState("");

  const rubrics = data.rubrics || [];

  const addRubric = () => {
    const items = itemsText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!name.trim() || items.length === 0) return;
    const rubric = { id: uid(), name: name.trim(), subject: subject.trim(), items };
    persist({ ...data, rubrics: [...rubrics, rubric] });
    setName(""); setSubject(""); setItemsText("");
  };

  const removeRubric = (id) => persist({ ...data, rubrics: rubrics.filter((r) => r.id !== id) });

  return (
    <Modal title="Rubric library" onClose={onClose}>
      <p className="bsf-muted" style={{ marginBottom: 12 }}>Build reusable rubrics once, then apply them when recording an assessment.</p>

      <div className="bsf-comments">
        {rubrics.length === 0 && <p className="bsf-empty">No rubrics saved yet.</p>}
        {rubrics.map((r) => (
          <div key={r.id} className="bsf-comment">
            <div className="bsf-row-head">
              <strong>{r.name}</strong>
              <button className="bsf-textbtn" onClick={() => removeRubric(r.id)}>Remove</button>
            </div>
            {r.subject && <p className="bsf-muted">{r.subject}</p>}
            <ul className="bsf-rubric-items">
              {r.items.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">New rubric</h3>
      <Field label="Rubric name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Writing a paragraph" />
      </Field>
      <Field label="Subject (optional)">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Literacy" />
      </Field>
      <Field label="Criteria, one per line">
        <textarea rows={4} value={itemsText} onChange={(e) => setItemsText(e.target.value)} placeholder={"Uses a clear topic sentence\nSupports ideas with detail\nUses correct punctuation"} />
      </Field>
      <button className="bsf-btn bsf-btn-block" onClick={addRubric}>Save rubric</button>
    </Modal>
  );
}

function StandardsLibraryModal({ data, persist, onClose }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");

  const standards = data.standards || [];

  const addStandard = () => {
    if (!description.trim()) return;
    const standard = { id: uid(), code: code.trim(), description: description.trim(), subject: subject.trim(), grade };
    persist({ ...data, standards: [...standards, standard] });
    setCode(""); setDescription(""); setSubject(""); setGrade("");
  };

  const removeStandard = (id) => persist({ ...data, standards: standards.filter((s) => s.id !== id) });

  const importBulk = () => {
    setBulkError("");
    setBulkSuccess("");
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setBulkError("Paste one standard per line before importing.");
      return;
    }
    const newStandards = [];
    for (const line of lines) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length < 2) {
        setBulkError(`This line is missing a pipe (|) separator: "${line.slice(0, 40)}..."`);
        return;
      }
      const [lineCode, lineSubject, lineGrade, ...rest] = parts;
      const lineDescription = rest.join("|").trim() || lineGrade || "";
      // Format is Code | Subject | Grade | Description (Grade is optional)
      if (parts.length >= 4) {
        newStandards.push({ id: uid(), code: lineCode, subject: lineSubject, grade: parts[2], description: parts.slice(3).join("|").trim() });
      } else {
        newStandards.push({ id: uid(), code: lineCode, subject: lineSubject, grade: "", description: lineDescription });
      }
    }
    persist({ ...data, standards: [...standards, ...newStandards] });
    setBulkText("");
    setBulkSuccess(`Added ${newStandards.length} standard${newStandards.length === 1 ? "" : "s"}.`);
  };

  return (
    <Modal title="Standards library" onClose={onClose}>
      <p className="bsf-muted" style={{ marginBottom: 12 }}>Build a list of curriculum standards once, then tag assessments to them to track progress over time.</p>

      <div className="bsf-comments">
        {standards.length === 0 && <p className="bsf-empty">No standards added yet.</p>}
        {standards.map((s) => (
          <div key={s.id} className="bsf-comment">
            <div className="bsf-row-head">
              <strong>{s.code ? `${s.code} · ` : ""}{s.subject}{s.grade ? ` · ${s.grade}` : ""}</strong>
              <button className="bsf-textbtn" onClick={() => removeStandard(s.id)}>Remove</button>
            </div>
            <p>{s.description}</p>
          </div>
        ))}
      </div>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Import many at once</h3>
      <p className="bsf-muted" style={{ marginBottom: 8 }}>
        Paste one standard per line, in this format: <code>Code | Subject | Grade | Description</code>. Grade can be left blank.
        For example: <code>CCSS.MATH.3.OA.1 | Math | Grade 3 | Interpret products of whole numbers</code>
      </p>
      <Field label="Paste standards here">
        <textarea rows={6} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="One standard per line" />
      </Field>
      <button className="bsf-btn bsf-btn-block" onClick={importBulk}>Import list</button>
      {bulkError && <p className="bsf-formerror">{bulkError}</p>}
      {bulkSuccess && <p className="bsf-muted">{bulkSuccess}</p>}

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Add one standard</h3>
      <Field label="Code (optional)">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CCSS.MATH.3.OA.1" />
      </Field>
      <Field label="Description">
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Solves two step word problems" />
      </Field>
      <Field label="Subject">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Math" />
      </Field>
      <Field label="Grade (optional)">
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">Any grade</option>
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </Field>
      <button className="bsf-btn bsf-btn-block" onClick={addStandard}>Save standard</button>
    </Modal>
  );
}

const ASSESSMENT_TYPES = ["Pre-Assessment", "Formative", "Summative (End of Unit)", "MAP Test", "End of Grade Test", "Other"];

// Pre-N through Kindergarten: no formal assessment, their record lives in Portfolio.
// Grade 1: Pre-Assessment, Formative, Summative.
// Grade 2 and up: MAP Test joins in.
// Grade 3 and up: End of Grade Test joins in.
function assessmentTypesForGrade(grade) {
  const idx = GRADES.indexOf(grade);
  const g1 = GRADES.indexOf("Grade 1");
  const g2 = GRADES.indexOf("Grade 2");
  const g3 = GRADES.indexOf("Grade 3");
  if (idx < g1) return [];
  const types = ["Pre-Assessment", "Formative", "Summative (End of Unit)"];
  if (idx >= g2) types.push("MAP Test");
  if (idx >= g3) types.push("End of Grade Test");
  types.push("Other");
  return types;
}

function AssessmentTab({ data, persist, profile }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showRubrics, setShowRubrics] = useState(false);
  const [showStandards, setShowStandards] = useState(false);
  const [gradeFilter, setGradeFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    studentId: "", planId: "", subject: "", criteria: "", level: ASSESS_LEVELS[1],
    feedback: "", rubricId: "", rows: [], standardId: "", assessmentType: ""
  });

  const isParent = profile?.role === "parent";
  const isStudent = profile?.role === "student";
  const isSelfOnly = isParent || isStudent;
  const isStaffScoped = profile?.role === "teacher" || profile?.role === "learning_assistant";
  const linkedIds = profile?.student_ids || [];
  const myAssignedGrades = profile?.grades_assigned || [];
  const myGrades = isSelfOnly
    ? [...new Set(data.students.filter((s) => linkedIds.includes(s.id)).map((s) => s.grade))]
    : isStaffScoped
    ? myAssignedGrades
    : [];

  const assessments = [...(data.assessments || [])]
    .filter((a) => !isSelfOnly || linkedIds.includes(a.studentId))
    .filter((a) => !isStaffScoped || myAssignedGrades.includes(a.grade))
    .sort((a, b) => b.date.localeCompare(a.date));
  const filtered = assessments
    .filter((a) => !gradeFilter || a.grade === gradeFilter)
    .filter((a) => !typeFilter || (a.assessmentType || "Summative (End of Unit)") === typeFilter);
  const rubrics = data.rubrics || [];
  const standards = data.standards || [];

  const eligiblePlans = form.studentId
    ? data.plans.filter((p) => {
        const student = data.students.find((s) => s.id === form.studentId);
        if (!student) return false;
        return !p.grades || p.grades.length === 0 || p.grades.includes(student.grade);
      })
    : data.plans;

  const applyRubric = (rubricId) => {
    const rubric = rubrics.find((r) => r.id === rubricId);
    setForm((f) => ({
      ...f,
      rubricId,
      subject: rubric && !f.subject ? (rubric.subject || f.subject) : f.subject,
      rows: rubric ? rubric.items.map((text) => ({ text, level: ASSESS_LEVELS[1] })) : []
    }));
  };

  const setRowLevel = (idx, level) => {
    setForm((f) => ({ ...f, rows: f.rows.map((r, i) => (i === idx ? { ...r, level } : r)) }));
  };

  const addAssessment = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student before saving.");
      return;
    }
    if (!form.assessmentType) {
      setFormError("Please choose an assessment type before saving.");
      return;
    }
    const usingRubric = form.rubricId && form.rows.length > 0;
    if (!usingRubric && !form.criteria.trim()) {
      setFormError("Please describe what was assessed, or choose a rubric.");
      return;
    }
    const plan = data.plans.find((p) => p.id === form.planId);
    const rubric = rubrics.find((r) => r.id === form.rubricId);
    const standard = standards.find((s) => s.id === form.standardId);
    const entry = {
      id: uid(),
      studentId: student.id,
      studentName: student.name,
      grade: student.grade,
      planId: plan ? plan.id : "",
      planTitle: plan ? plan.title : "",
      subject: form.subject,
      feedback: form.feedback,
      standardId: form.standardId,
      standardLabel: standard ? (standard.code ? `${standard.code} - ${standard.description}` : standard.description) : "",
      assessmentType: form.assessmentType,
      date: new Date().toISOString().slice(0, 10),
      ...(usingRubric
        ? { rubricName: rubric ? rubric.name : "", rows: form.rows }
        : { criteria: form.criteria, level: form.level })
    };
    persist({ ...data, assessments: [...(data.assessments || []), entry] });
    setForm({ studentId: "", planId: "", subject: "", criteria: "", level: ASSESS_LEVELS[1], feedback: "", rubricId: "", rows: [], standardId: "", assessmentType: "" });
    setFormError("");
    setGradeFilter(null);
    setShowAdd(false);
  };

  const removeAssessment = (id) => persist({ ...data, assessments: (data.assessments || []).filter((a) => a.id !== id) });

  const levelCounts = useMemo(() => {
    const counts = {};
    ASSESS_LEVELS.forEach((l) => { counts[l] = 0; });
    filtered.forEach((a) => {
      if (a.level) counts[a.level] = (counts[a.level] || 0) + 1;
      (a.rows || []).forEach((r) => { if (r.level) counts[r.level] = (counts[r.level] || 0) + 1; });
    });
    return counts;
  }, [filtered]);

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Assessment</p>
        <h1>{filtered.length} record{filtered.length === 1 ? "" : "s"}</h1>
        {filtered.length > 0 && (
          <div className="bsf-attend-segbar" style={{ marginTop: 14 }}>
            {ASSESS_LEVELS.filter((l) => levelCounts[l] > 0).map((l) => (
              <span key={l} style={{ flex: levelCounts[l], background: getLevelColor(l) }} />
            ))}
          </div>
        )}
      </div>

      <div className="bsf-screen-head bsf-screen-head-wrap" style={{ marginBottom: 0 }}>
        <span />
        {!isSelfOnly && (
          <div className="bsf-screen-head-actions">
            <button className="bsf-btn bsf-btn-ghost" onClick={() => setShowStandards(true)}>Standards</button>
            <button className="bsf-btn bsf-btn-ghost" onClick={() => setShowRubrics(true)}>Rubrics</button>
            <button className="bsf-btn" onClick={() => { setFormError(""); setShowAdd(true); }} disabled={data.students.length === 0}><Plus size={16} /> Add</button>
          </div>
        )}
      </div>
      {data.students.length === 0 && !isSelfOnly && <p className="bsf-empty">Add students first, then record assessments here.</p>}
      {isSelfOnly && filtered.length === 0 && <p className="bsf-empty">{isStudent ? "No assessment records yet." : "No assessment records yet for your child."}</p>}

      {data.students.length > 0 && (!isSelfOnly && !isStaffScoped || myGrades.length > 1) && (
        <section className="bsf-card">
          <h2>Filter by grade</h2>
          <div className="bsf-chiprow">
            <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>All</button>
            {((isSelfOnly || isStaffScoped) ? myGrades : GRADES).map((g) => (
              <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{g}</button>
            ))}
          </div>
        </section>
      )}

      <section className="bsf-card">
        <h2>Filter by type</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${typeFilter === null ? "active" : ""}`} onClick={() => setTypeFilter(null)}>All</button>
          {ASSESSMENT_TYPES.map((t) => (
            <button key={t} className={`bsf-chip ${typeFilter === t ? "active" : ""}`} onClick={() => setTypeFilter(t)}>{t}</button>
          ))}
        </div>
      </section>

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No assessments recorded yet.</p>}
        {filtered.map((a) => {
          const student = data.students.find((s) => s.id === a.studentId);
          return (
            <div key={a.id} className="bsf-card bsf-portfolio-entry">
              <StudentThumb photo={student?.photo} />
              <div style={{ flex: 1 }}>
                <div className="bsf-row-head">
                  {a.rows && a.rows.length > 0 ? (
                    <span className="bsf-tag">{a.rubricName || "Rubric"}</span>
                  ) : (
                    <span
                      className="bsf-status-pill"
                      style={{ background: `${getLevelColor(a.level)}1A`, color: getLevelColor(a.level) }}
                    >
                      {a.level}
                    </span>
                  )}
                  <span className="bsf-muted">{a.date}</span>
                </div>
                <strong>{a.studentName}</strong>
                {a.assessmentType && <span className="bsf-minitag" style={{ marginTop: 2, display: "inline-block" }}>{a.assessmentType}</span>}
                <p className="bsf-muted">{a.grade}{a.subject ? ` · ${a.subject}` : ""}{a.planTitle ? ` · ${a.planTitle}` : ""}</p>
                {a.rows && a.rows.length > 0 ? (
                  <div className="bsf-rubric-rows">
                    {a.rows.map((r, i) => (
                      <div key={i} className="bsf-rubric-row">
                        <span>{r.text}</span>
                        <span className="bsf-status-pill" style={{ background: `${getLevelColor(r.level)}1A`, color: getLevelColor(r.level) }}>
                          {r.level}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>{a.criteria}</p>
                )}
                {a.feedback && <p className="bsf-muted">{a.feedback}</p>}
                {a.standardLabel && <p className="bsf-muted">Standard: {a.standardLabel}</p>}
              </div>
              {!isSelfOnly && <button className="bsf-iconbtn" onClick={() => removeAssessment(a.id)} aria-label="Remove"><Trash2 size={16} /></button>}
            </div>
          );
        })}
      </section>

      {showAdd && (
        <Modal title="New assessment" onClose={() => setShowAdd(false)}>
          <Field label="Student">
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value, planId: "", assessmentType: "" })}>
              <option value="">Choose a student</option>
              {(isStaffScoped ? data.students.filter((s) => myAssignedGrades.includes(s.grade)) : data.students)
                .filter((s) => GRADES.indexOf(s.grade) >= GRADES.indexOf("Grade 1"))
                .map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
            </select>
            <p className="bsf-muted" style={{ marginTop: 4 }}>
              Pre-N through Kindergarten aren't shown here, their assessment record is their Portfolio.
            </p>
          </Field>
          {form.studentId && (
            <Field label="Assessment type">
              <div className="bsf-chiprow">
                {assessmentTypesForGrade(data.students.find((s) => s.id === form.studentId)?.grade).map((t) => (
                  <button key={t} type="button" className={`bsf-chip ${form.assessmentType === t ? "active" : ""}`} onClick={() => setForm({ ...form, assessmentType: t })}>{t}</button>
                ))}
              </div>
            </Field>
          )}
          <Field label="Linked unit plan (optional)">
            <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
              <option value="">No unit plan</option>
              {eligiblePlans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
          <Field label="Subject">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Math, Literacy" />
          </Field>
          <Field label="Use a rubric (optional)">
            <select value={form.rubricId} onChange={(e) => applyRubric(e.target.value)}>
              <option value="">No rubric, use free text below</option>
              {rubrics.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Linked standard (optional)">
            <select value={form.standardId} onChange={(e) => setForm({ ...form, standardId: e.target.value })}>
              <option value="">No standard</option>
              {standards.map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code} - ` : ""}{s.description}</option>)}
            </select>
          </Field>

          {form.rows.length > 0 ? (
            <div className="bsf-rubric-form">
              {form.rows.map((row, idx) => (
                <div key={idx} className="bsf-rubric-form-row">
                  <p className="bsf-rubric-form-label">{row.text}</p>
                  <div className="bsf-chiprow">
                    {ASSESS_LEVELS.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        className={`bsf-chip ${row.level === lvl ? "active" : ""}`}
                        onClick={() => setRowLevel(idx, lvl)}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <Field label="What was assessed">
                <input value={form.criteria} onChange={(e) => setForm({ ...form, criteria: e.target.value })} placeholder="e.g. Adding two digit numbers" />
              </Field>
              <Field label="Level">
                <div className="bsf-chiprow">
                  {ASSESS_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      className={`bsf-chip ${form.level === lvl ? "active" : ""}`}
                      onClick={() => setForm({ ...form, level: lvl })}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          <Field label="Feedback">
            <textarea rows={3} value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} placeholder="Notes for the student or family" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={addAssessment}>Save assessment</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {showRubrics && <RubricLibraryModal data={data} persist={persist} onClose={() => setShowRubrics(false)} />}
      {showStandards && <StandardsLibraryModal data={data} persist={persist} onClose={() => setShowStandards(false)} />}
    </div>
  );
}

const OFFICIAL_CALENDAR_2026_27 = [
  { title: "Faculty Orientation", type: "Staff", date: "2026-08-17", endDate: "2026-08-25" },
  { title: "Prophet's Birthday", type: "Holiday", date: "2026-08-26" },
  { title: "First Day of School", type: "Academic", date: "2026-08-27" },
  { title: "Welcome Coffee", type: "Event", date: "2026-09-04" },
  { title: "Halloween / Culture Day", type: "Event", date: "2026-10-16" },
  { title: "October Break", type: "Holiday", date: "2026-10-19", endDate: "2026-10-23" },
  { title: "All Saint Day", type: "Holiday", date: "2026-11-01" },
  { title: "Student Led Conferences", type: "Academic", date: "2026-11-09", endDate: "2026-11-13" },
  { title: "Peace Day", type: "Holiday", date: "2026-11-15" },
  { title: "School Holiday", type: "Holiday", date: "2026-11-16" },
  { title: "Thanksgiving Break", type: "Holiday", date: "2026-11-26", endDate: "2026-11-27" },
  { title: "Holiday Concert", type: "Event", date: "2026-12-11" },
  { title: "December Break", type: "Holiday", date: "2026-12-16", endDate: "2027-01-08" },
  { title: "Christmas Day", type: "Holiday", date: "2026-12-25" },
  { title: "New Year", type: "Holiday", date: "2027-01-01" },
  { title: "Resume School", type: "Academic", date: "2027-01-11" },
  { title: "February Break", type: "Holiday", date: "2027-02-18", endDate: "2027-02-19" },
  { title: "Lay Qadr (TBD)", type: "Holiday", date: "2027-03-06" },
  { title: "Sit A Fitr (TBD)", type: "Holiday", date: "2027-03-09" },
  { title: "Spring Break", type: "Holiday", date: "2027-03-22", endDate: "2027-03-26" },
  { title: "Easter", type: "Holiday", date: "2027-03-28" },
  { title: "Easter Monday", type: "Holiday", date: "2027-03-29" },
  { title: "School Resumes", type: "Academic", date: "2027-04-05" },
  { title: "Labor Day", type: "Holiday", date: "2027-05-01" },
  { title: "Ascension", type: "Holiday", date: "2027-05-06" },
  { title: "Pentecote Monday", type: "Holiday", date: "2027-05-17" },
  { title: "Last Day of School", type: "Academic", date: "2027-06-08" }
];

function CalendarTab({ data, persist, profile }) {
  const [showAdd, setShowAdd] = useState(false);
  const [typeFilter, setTypeFilter] = useState(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ title: "", type: EVENT_TYPES[0], date: "", endDate: "", grades: [], description: "" });

  const isParent = profile?.role === "parent";
  const linkedIds = profile?.student_ids || [];
  const myGrades = isParent ? [...new Set(data.students.filter((s) => linkedIds.includes(s.id)).map((s) => s.grade))] : [];

  const events = [...(data.events || [])]
    .filter((e) => !isParent || !e.grades || e.grades.length === 0 || e.grades.some((g) => myGrades.includes(g)))
    .sort((a, b) => a.date.localeCompare(b.date));
  const today = todayStr();
  const filtered = typeFilter ? events.filter((e) => e.type === typeFilter) : events;
  const upcoming = filtered.filter((e) => (e.endDate || e.date) >= today);
  const past = filtered.filter((e) => (e.endDate || e.date) < today);

  const toggleGrade = (g) => {
    setForm((f) => ({ ...f, grades: f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g] }));
  };

  const addEvent = () => {
    if (!form.title.trim() || !form.date) {
      setFormError("Please add a title and a date.");
      return;
    }
    persist({ ...data, events: [...(data.events || []), { id: uid(), ...form }] });
    setForm({ title: "", type: EVENT_TYPES[0], date: "", endDate: "", grades: [], description: "" });
    setFormError("");
    setTypeFilter(null);
    setShowAdd(false);
  };

  const removeEvent = (id) => persist({ ...data, events: (data.events || []).filter((e) => e.id !== id) });

  const alreadyLoaded = OFFICIAL_CALENDAR_2026_27.every((oe) =>
    (data.events || []).some((e) => e.title === oe.title && e.date === oe.date)
  );

  const importOfficialCalendar = () => {
    const existing = data.events || [];
    const toAdd = OFFICIAL_CALENDAR_2026_27.filter(
      (oe) => !existing.some((e) => e.title === oe.title && e.date === oe.date)
    ).map((oe) => ({ id: uid(), grades: [], description: "", ...oe }));
    if (toAdd.length === 0) return;

    const settings = data.settings || DEFAULT_SETTINGS;
    const needsYearFill = !settings.academicYear.startDate && !settings.academicYear.endDate;
    const nextSettings = needsYearFill
      ? { ...settings, academicYear: { startDate: "2026-08-27", endDate: "2027-06-08" } }
      : settings;

    persist({ ...data, events: [...existing, ...toAdd], settings: nextSettings });
  };

  const renderEvent = (e) => (
    <div key={e.id} className="bsf-card bsf-student">
      <div>
        <div className="bsf-row-head">
          <span className="bsf-status-pill" style={{ background: `${EVENT_TYPE_COLOR[e.type]}1A`, color: EVENT_TYPE_COLOR[e.type] }}>
            {e.type}
          </span>
          <span className="bsf-muted">{e.date}{e.endDate && e.endDate !== e.date ? ` to ${e.endDate}` : ""}</span>
        </div>
        <strong>{e.title}</strong>
        <p className="bsf-muted">{e.grades && e.grades.length > 0 ? e.grades.join(", ") : "Whole school"}</p>
        {e.description && <p>{e.description}</p>}
      </div>
      {!isParent && <button className="bsf-iconbtn" onClick={() => removeEvent(e.id)} aria-label="Remove"><Trash2 size={16} /></button>}
    </div>
  );

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Calendar</p>
        <h1>{upcoming.length} upcoming event{upcoming.length === 1 ? "" : "s"}</h1>
        {upcoming[0] && <p className="bsf-hero-sub">Next: {upcoming[0].title} · {upcoming[0].date}</p>}
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        {!isParent && <button className="bsf-btn" onClick={() => setShowAdd(true)}><Plus size={16} /> Add</button>}
      </div>

      {!isParent && !alreadyLoaded && (
        <button type="button" className="bsf-templatebtn" onClick={importOfficialCalendar}>
          Load the 2026–27 academic calendar
        </button>
      )}

      <section className="bsf-card">
        <h2>Filter by type</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${typeFilter === null ? "active" : ""}`} onClick={() => setTypeFilter(null)}>All</button>
          {EVENT_TYPES.map((t) => (
            <button key={t} className={`bsf-chip ${typeFilter === t ? "active" : ""}`} onClick={() => setTypeFilter(t)}>{t}</button>
          ))}
        </div>
      </section>

      <section className="bsf-list">
        <h2 className="bsf-listheading">Upcoming</h2>
        {upcoming.length === 0 && <p className="bsf-empty">Nothing scheduled yet.</p>}
        {upcoming.map(renderEvent)}
      </section>

      {past.length > 0 && (
        <section className="bsf-list">
          <h2 className="bsf-listheading">Past</h2>
          {past.map(renderEvent)}
        </section>
      )}

      {showAdd && (
        <Modal title="New calendar event" onClose={() => setShowAdd(false)}>
          <Field label="Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Welcome Coffee" />
          </Field>
          <Field label="Type">
            <div className="bsf-chiprow">
              {EVENT_TYPES.map((t) => (
                <button key={t} type="button" className={`bsf-chip ${form.type === t ? "active" : ""}`} onClick={() => setForm({ ...form, type: t })}>{t}</button>
              ))}
            </div>
          </Field>
          <div className="bsf-two-col">
            <Field label="Date">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="End date (optional)">
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
          </div>
          <Field label="Grades (optional, leave blank for whole school)">
            <div className="bsf-chiprow">
              {GRADES.map((g) => (
                <button key={g} type="button" className={`bsf-chip ${form.grades.includes(g) ? "active" : ""}`} onClick={() => toggleGrade(g)}>{g}</button>
              ))}
            </div>
          </Field>
          <Field label="Description">
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional details" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={addEvent}>Save event</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

const emptyAdmissionForm = {
  childName: "", gradeInterested: GRADES[0], guardianName: "", guardianContact: "",
  source: ADMISSION_SOURCES[0], stage: ADMISSION_STAGES[0], inquiryDate: "", followUpDate: "", notes: ""
};

function AdmissionsTab({ data, persist }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [stageFilter, setStageFilter] = useState(null);
  const [form, setForm] = useState(emptyAdmissionForm);
  const [formError, setFormError] = useState("");

  const admissions = [...(data.admissions || [])].sort((a, b) => (b.inquiryDate || "").localeCompare(a.inquiryDate || ""));
  const filtered = stageFilter ? admissions.filter((a) => a.stage === stageFilter) : admissions;

  const counts = useMemo(() => {
    const c = {};
    (data.admissions || []).forEach((a) => { c[a.stage] = (c[a.stage] || 0) + 1; });
    return c;
  }, [data.admissions]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyAdmissionForm, inquiryDate: todayStr() });
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (a) => {
    setEditingId(a.id);
    setForm({ ...emptyAdmissionForm, ...a });
    setFormError("");
    setShowForm(true);
  };

  const saveAdmission = () => {
    if (!form.childName.trim()) {
      setFormError("Please enter the child's name before saving.");
      return;
    }
    if (editingId) {
      persist({ ...data, admissions: (data.admissions || []).map((a) => (a.id === editingId ? { ...a, ...form } : a)) });
    } else {
      persist({ ...data, admissions: [...(data.admissions || []), { id: uid(), ...form }] });
      setStageFilter(null);
    }
    setForm(emptyAdmissionForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeAdmission = (id) => persist({ ...data, admissions: (data.admissions || []).filter((a) => a.id !== id) });

  const convertToStudent = (a) => {
    const parts = a.childName.trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
    const newStudent = {
      id: uid(),
      ...emptyStudentForm,
      firstName,
      lastName,
      name: a.childName,
      grade: a.gradeInterested,
      guardian1Name: a.guardianName,
      guardian1Phone: a.guardianContact,
      enrollmentDate: todayStr()
    };
    persist({
      ...data,
      students: [...data.students, newStudent],
      admissions: data.admissions.map((x) => (x.id === a.id ? { ...x, addedToRoster: true } : x))
    });
  };

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Admissions</p>
        <h1>{(data.admissions || []).length} in the pipeline</h1>
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>
      </div>

      <section className="bsf-card">
        <h2>Filter by stage</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${stageFilter === null ? "active" : ""}`} onClick={() => setStageFilter(null)}>All ({admissions.length})</button>
          {ADMISSION_STAGES.map((s) => (
            <button key={s} className={`bsf-chip ${stageFilter === s ? "active" : ""}`} onClick={() => setStageFilter(s)}>
              {s} ({counts[s] || 0})
            </button>
          ))}
        </div>
      </section>

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No admissions leads yet.</p>}
        {filtered.map((a) => (
          <div key={a.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEdit(a)}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-status-pill" style={{ background: `${ADMISSION_STAGE_COLOR[a.stage]}1A`, color: ADMISSION_STAGE_COLOR[a.stage] }}>
                  {a.stage}
                </span>
                <span className="bsf-muted">{a.inquiryDate}</span>
              </div>
              <strong>{a.childName}</strong>
              <p className="bsf-muted">{a.gradeInterested} · {a.source}</p>
              {a.guardianName && <p className="bsf-muted">{a.guardianName}{a.guardianContact ? ` · ${a.guardianContact}` : ""}</p>}
              {a.followUpDate && <p className="bsf-muted">Follow up: {a.followUpDate}</p>}
              {a.notes && <p>{a.notes}</p>}
              {a.stage === "Enrolled" && !a.addedToRoster && (
                <button className="bsf-textbtn" onClick={(e) => { e.stopPropagation(); convertToStudent(a); }}>Add to Students roster</button>
              )}
              {a.addedToRoster && <span className="bsf-minitag">Added to roster</span>}
            </div>
            <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeAdmission(a.id); }} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title={editingId ? "Edit admissions lead" : "New admissions lead"} onClose={() => setShowForm(false)}>
          <Field label="Child's name">
            <input value={form.childName} onChange={(e) => setForm({ ...form, childName: e.target.value })} placeholder="Full name" />
          </Field>
          <Field label="Grade interested">
            <select value={form.gradeInterested} onChange={(e) => setForm({ ...form, gradeInterested: e.target.value })}>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Guardian name">
            <input value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
          </Field>
          <Field label="Guardian contact">
            <input value={form.guardianContact} onChange={(e) => setForm({ ...form, guardianContact: e.target.value })} placeholder="Phone or WhatsApp" />
          </Field>
          <Field label="Source">
            <div className="bsf-chiprow">
              {ADMISSION_SOURCES.map((s) => (
                <button key={s} type="button" className={`bsf-chip ${form.source === s ? "active" : ""}`} onClick={() => setForm({ ...form, source: s })}>{s}</button>
              ))}
            </div>
          </Field>
          <Field label="Stage">
            <div className="bsf-chiprow">
              {ADMISSION_STAGES.map((s) => (
                <button key={s} type="button" className={`bsf-chip ${form.stage === s ? "active" : ""}`} onClick={() => setForm({ ...form, stage: s })}>{s}</button>
              ))}
            </div>
          </Field>
          <div className="bsf-two-col">
            <Field label="Inquiry date">
              <input type="date" value={form.inquiryDate} onChange={(e) => setForm({ ...form, inquiryDate: e.target.value })} />
            </Field>
            <Field label="Follow up date">
              <input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Tour feedback, questions, anything worth remembering" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveAdmission}>{editingId ? "Save changes" : "Save lead"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

const emptyAssignmentForm = { title: "", description: "", grades: [], subject: "", dueDate: "", link: "", files: [] };

function AssignmentsTab({ data, persist, profile }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [gradeFilter, setGradeFilter] = useState(null);
  const [form, setForm] = useState(emptyAssignmentForm);
  const [formError, setFormError] = useState("");

  const isParent = profile?.role === "parent";
  const isStudent = profile?.role === "student";
  const isSelfOnly = isParent || isStudent;
  const linkedIds = profile?.student_ids || [];
  const myGrades = isSelfOnly ? [...new Set(data.students.filter((s) => linkedIds.includes(s.id)).map((s) => s.grade))] : [];
  const myStudentId = isStudent ? linkedIds[0] : null;

  const today = todayStr();
  const assignments = [...(data.assignments || [])]
    .filter((a) => !isSelfOnly || (a.grades || []).some((g) => myGrades.includes(g)))
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  const filtered = gradeFilter ? assignments.filter((a) => (a.grades || []).includes(gradeFilter)) : assignments;
  const upcoming = filtered.filter((a) => !a.dueDate || a.dueDate >= today);
  const past = filtered.filter((a) => a.dueDate && a.dueDate < today);

  const saveMySubmission = (assignmentId, patch) => {
    persist({
      ...data,
      assignments: (data.assignments || []).map((a) =>
        a.id === assignmentId
          ? { ...a, submissions: { ...(a.submissions || {}), [myStudentId]: { ...(a.submissions?.[myStudentId] || {}), ...patch, date: todayStr() } } }
          : a
      )
    });
  };

  const toggleGrade = (g) => {
    setForm((f) => ({ ...f, grades: f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g] }));
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyAssignmentForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (a) => {
    setEditingId(a.id);
    setForm({ ...emptyAssignmentForm, ...a });
    setFormError("");
    setShowForm(true);
  };

  const saveAssignment = () => {
    if (!form.title.trim() || form.grades.length === 0) {
      setFormError("Please add a title and choose at least one grade.");
      return;
    }
    if (editingId) {
      persist({ ...data, assignments: (data.assignments || []).map((a) => (a.id === editingId ? { ...a, ...form } : a)) });
    } else {
      persist({ ...data, assignments: [...(data.assignments || []), { id: uid(), ...form }] });
      setGradeFilter(null);
    }
    setForm(emptyAssignmentForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeAssignment = (id) => persist({ ...data, assignments: (data.assignments || []).filter((a) => a.id !== id) });

  const renderAssignment = (a) => (
    <div key={a.id} className={`bsf-card bsf-student ${isSelfOnly ? "" : "bsf-clickable"}`} onClick={() => { if (!isSelfOnly) openEdit(a); }}>
      <div>
        <div className="bsf-row-head">
          <span className="bsf-tag">{(a.grades || []).length === GRADES.length ? "All grades" : (a.grades || []).join(", ")}</span>
          {a.dueDate && <span className="bsf-muted">Due {a.dueDate}</span>}
        </div>
        {a.subject && <p className="bsf-muted">{a.subject}</p>}
        <strong>{a.title}</strong>
        {a.description && <p>{a.description}</p>}
        {a.link && <p className="bsf-muted">{a.link}</p>}
        {(!isSelfOnly || (a.files || []).length > 0) && (
          <div onClick={(e) => e.stopPropagation()}>
            <AttachmentField
              folder="assignments"
              files={a.files || []}
              onChange={(files) =>
                persist({ ...data, assignments: (data.assignments || []).map((x) => (x.id === a.id ? { ...x, files } : x)) })
              }
              readOnly={isSelfOnly}
            />
          </div>
        )}
        {isStudent && (
          <div onClick={(e) => e.stopPropagation()} className="bsf-mysubmission">
            <hr className="bsf-divider" />
            <p className="bsf-group-label" style={{ margin: "0 0 8px" }}>My work</p>
            {a.submissions?.[myStudentId]?.date && (
              <p className="bsf-muted" style={{ marginBottom: 6 }}>Last saved {a.submissions[myStudentId].date}</p>
            )}
            <textarea
              rows={2}
              placeholder="Write your answer or notes here..."
              value={a.submissions?.[myStudentId]?.note || ""}
              onChange={(e) => saveMySubmission(a.id, { note: e.target.value })}
            />
            <AttachmentField
              folder="assignments"
              files={a.submissions?.[myStudentId]?.files || []}
              onChange={(files) => saveMySubmission(a.id, { files })}
            />
          </div>
        )}
      </div>
      {!isSelfOnly && <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeAssignment(a.id); }} aria-label="Remove"><Trash2 size={16} /></button>}
    </div>
  );

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Assignments</p>
        <h1>{upcoming.length} due{upcoming.length === 1 ? "" : ""} ahead</h1>
        {upcoming[0] && <p className="bsf-hero-sub">Next: {upcoming[0].title}{upcoming[0].dueDate ? ` · Due ${upcoming[0].dueDate}` : ""}</p>}
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        {!isSelfOnly && <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>}
      </div>

      <section className="bsf-card">
        <h2>Filter by grade</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>All</button>
          {(isSelfOnly ? myGrades : GRADES).map((g) => (
            <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{g}</button>
          ))}
        </div>
      </section>

      <section className="bsf-list">
        <h2 className="bsf-listheading">Due</h2>
        {upcoming.length === 0 && <p className="bsf-empty">Nothing assigned yet.</p>}
        {upcoming.map(renderAssignment)}
      </section>

      {past.length > 0 && (
        <section className="bsf-list">
          <h2 className="bsf-listheading">Past due</h2>
          {past.map(renderAssignment)}
        </section>
      )}

      {showForm && (
        <Modal title={editingId ? "Edit assignment" : "New assignment"} onClose={() => setShowForm(false)}>
          <Field label="Grades">
            <div className="bsf-chiprow">
              <button
                type="button"
                className={`bsf-chip ${form.grades.length === GRADES.length ? "active" : ""}`}
                onClick={() => setForm({ ...form, grades: form.grades.length === GRADES.length ? [] : [...GRADES] })}
              >
                All grades
              </button>
              {GRADES.map((g) => (
                <button key={g} type="button" className={`bsf-chip ${form.grades.includes(g) ? "active" : ""}`} onClick={() => toggleGrade(g)}>{g}</button>
              ))}
            </div>
          </Field>
          <Field label="Subject">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Math, Literacy" />
          </Field>
          <Field label="Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Fractions worksheet" />
          </Field>
          <Field label="Description">
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What students need to do" />
          </Field>
          <Field label="Due date">
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
          <Field label="Link (optional)">
            <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Link to a worksheet or resource" />
          </Field>
          <Field label="Attachments (optional)">
            <AttachmentField folder="assignments" files={form.files} onChange={(files) => setForm({ ...form, files })} />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveAssignment}>{editingId ? "Save changes" : "Post assignment"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

function ReportViewModal({ report, data, onClose, onRemove }) {
  const kind = report.kind || "student";
  const settings = data?.settings || DEFAULT_SETTINGS;
  const student = data?.students.find((s) => s.id === report.studentId);
  const isLevelsReport = (report.grades || []).some((g) => g.scoreType === "Levels");

  return (
    <Modal
      title={
        kind === "student" ? `${report.studentName}'s report`
        : kind === "attendance" ? "Attendance report"
        : kind === "assessment" ? "Assessment report"
        : kind === "behavior" ? "Behavior report"
        : kind === "transcript" ? `${report.studentName}'s transcript`
        : "Standards report"
      }
      onClose={onClose}
    >
      {(kind === "student" || kind === "transcript") && (
        <button className="bsf-btn bsf-btn-block bsf-noprint" style={{ marginBottom: 16 }} onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      )}

      <div className={(kind === "student" || kind === "transcript") ? "bsf-printable" : ""}>
        {(kind === "student" || kind === "transcript") && (
          <div className="bsf-letterhead">
            {settings.branding.logoUrl && <img src={settings.branding.logoUrl} alt="" className="bsf-letterhead-logo" />}
            <h2>BrightSteps International School</h2>
            <p className="bsf-muted">{kind === "student" ? "Progress Report" : "Academic Transcript"}</p>
            <table className="bsf-letterhead-table">
              <tbody>
                <tr><td>Student Name</td><td>{report.studentName}</td></tr>
                <tr><td>Grade</td><td>{report.grade}</td></tr>
                <tr><td>Academic Year</td><td>{settings.academicYear.startDate ? settings.academicYear.startDate.slice(0, 4) : "?"}/{settings.academicYear.endDate ? settings.academicYear.endDate.slice(0, 4) : "?"}</td></tr>
                <tr><td>Period</td><td>{report.periodStart || "?"} to {report.periodEnd || "?"}</td></tr>
                {student?.nationalities?.length > 0 && <tr><td>Nationality</td><td>{student.nationalities.join(" - ")}</td></tr>}
              </tbody>
            </table>
            {kind === "student" && (
              <div className="bsf-letterhead-legend">
                {isLevelsReport ? (
                  <>
                    <strong>Understanding Progress Levels</strong>
                    <p>Emerging – Beginning to explore and show early understanding</p>
                    <p>Developing – Growing and applying skills with support</p>
                    <p>Proficient – Using skills consistently and independently</p>
                    <p>Confident – Applying skills confidently across situations</p>
                  </>
                ) : (
                  <>
                    <strong>Understanding Grades</strong>
                    {Object.entries(LETTER_GRADE_MEANING).map(([letter, meaning]) => (
                      <p key={letter}><strong>{letter}</strong> — {meaning} ({LEARNING_PROGRESS_BAND[letter]})</p>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

      {kind === "student" && (
        <>
          <p className="bsf-muted bsf-noprint">{report.template} · Generated {report.createdDate}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Attendance</h3>
          <p className="bsf-muted">
            {report.attendanceSummary.present} present · {report.attendanceSummary.absent} absent · {report.attendanceSummary.late} late during this period
          </p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Grades</h3>
          {(!report.grades || report.grades.length === 0) && <p className="bsf-empty">No grades recorded in this period.</p>}
          {(report.grades || []).map((g, i) => (
            <div key={i} className="bsf-row">
              <span className="bsf-status-pill" style={{ background: `${LETTER_GRADE_COLOR[g.letter] || "#8A9698"}1A`, color: LETTER_GRADE_COLOR[g.letter] || "#8A9698" }}>
                {g.scoreType === "Percentage" ? `${g.score}% · ${g.letter}` : g.letter}
              </span>
              <div>
                <strong>{g.subject}{g.term ? ` · ${g.term}` : ""}</strong>
                {g.comments && <p>{g.comments}</p>}
              </div>
            </div>
          ))}

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Assessments</h3>
          {report.assessments.length === 0 && <p className="bsf-empty">No assessments recorded in this period.</p>}
          {report.assessments.map((a, i) => (
            <div key={i} className="bsf-comment">
              <div className="bsf-row-head">
                <strong>{a.subject || "General"}</strong>
                {a.rows && a.rows.length > 0 ? (
                  <span className="bsf-tag">{a.rubricName || "Rubric"}</span>
                ) : (
                  <span className="bsf-status-pill" style={{ background: `${getLevelColor(a.level)}1A`, color: getLevelColor(a.level) }}>{a.level}</span>
                )}
              </div>
              {a.rows && a.rows.length > 0 ? (
                <div className="bsf-rubric-rows">
                  {a.rows.map((r, j) => (
                    <div key={j} className="bsf-rubric-row">
                      <span>{r.text}</span>
                      <span className="bsf-status-pill" style={{ background: `${getLevelColor(r.level)}1A`, color: getLevelColor(r.level) }}>{r.level}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{a.criteria}</p>
              )}
              {a.feedback && <p className="bsf-muted">{a.feedback}</p>}
            </div>
          ))}

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Portfolio highlights</h3>
          {report.portfolio.length === 0 && <p className="bsf-empty">No portfolio entries in this period.</p>}
          {report.portfolio.map((p, i) => (
            <div key={i} className="bsf-comment">
              <div className="bsf-row-head">
                <span className="bsf-tag">{p.tag}</span>
                <span className="bsf-muted">{p.date}</span>
              </div>
              <p>{p.note}</p>
            </div>
          ))}

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Teacher comments</h3>
          <p>{report.teacherComments || "No comments added."}</p>

          <div className="bsf-signatureblock">
            <div>
              <p>Teacher: ________________________________</p>
            </div>
            <div>
              <p>Date: ________________________________</p>
            </div>
          </div>
        </>
      )}

      {kind === "attendance" && (
        <>
          <p className="bsf-muted">{report.grade} · Period: {report.periodStart || "?"} to {report.periodEnd || "?"}</p>
          <p className="bsf-muted">Generated {report.createdDate}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Overall</h3>
          <p className="bsf-muted">
            {report.totals.present} present · {report.totals.absent} absent · {report.totals.late} late · {report.rate}% attendance rate
          </p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">By student</h3>
          {report.rows.length === 0 && <p className="bsf-empty">No attendance recorded in this period.</p>}
          {report.rows.map((r, i) => (
            <div key={i} className="bsf-comment">
              <div className="bsf-row-head">
                <strong>{r.studentName}</strong>
                <span className="bsf-muted">{r.present}P · {r.absent}A · {r.late}L</span>
              </div>
            </div>
          ))}
        </>
      )}

      {kind === "assessment" && (
        <>
          <p className="bsf-muted">{report.grade}{report.subject ? ` · ${report.subject}` : ""} · Period: {report.periodStart || "?"} to {report.periodEnd || "?"}</p>
          <p className="bsf-muted">Generated {report.createdDate}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Level distribution</h3>
          <div className="bsf-rubric-rows">
            {Object.entries(report.levelCounts).map(([level, count]) => (
              <div key={level} className="bsf-rubric-row">
                <span>{level}</span>
                <span className="bsf-status-pill" style={{ background: `${getLevelColor(level)}1A`, color: getLevelColor(level) }}>{count}</span>
              </div>
            ))}
          </div>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Entries</h3>
          {report.entries.length === 0 && <p className="bsf-empty">No assessments recorded in this period.</p>}
          {report.entries.map((e, i) => (
            <div key={i} className="bsf-comment">
              <div className="bsf-row-head">
                <strong>{e.studentName}</strong>
                <span className="bsf-muted">{e.subject || "General"}</span>
              </div>
              {e.rows && e.rows.length > 0 ? (
                <div className="bsf-rubric-rows">
                  {e.rows.map((r, j) => (
                    <div key={j} className="bsf-rubric-row">
                      <span>{r.text}</span>
                      <span className="bsf-status-pill" style={{ background: `${getLevelColor(r.level)}1A`, color: getLevelColor(r.level) }}>{r.level}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="bsf-row-head">
                  <span>{e.criteria}</span>
                  <span className="bsf-status-pill" style={{ background: `${getLevelColor(e.level)}1A`, color: getLevelColor(e.level) }}>{e.level}</span>
                </p>
              )}
            </div>
          ))}
        </>
      )}

      {kind === "behavior" && (
        <>
          <p className="bsf-muted">{report.grade} · Period: {report.periodStart || "?"} to {report.periodEnd || "?"}</p>
          <p className="bsf-muted">Generated {report.createdDate}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Overview</h3>
          <p className="bsf-muted">{report.typeCounts.Positive || 0} positive notes · {report.typeCounts.Concern || 0} concerns</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">By category</h3>
          <div className="bsf-rubric-rows">
            {Object.entries(report.categoryCounts).map(([cat, count]) => (
              <div key={cat} className="bsf-rubric-row">
                <span>{cat}</span>
                <span className="bsf-status-pill" style={{ background: "#F5E4E6", color: "#801524" }}>{count}</span>
              </div>
            ))}
          </div>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Entries</h3>
          {report.entries.length === 0 && <p className="bsf-empty">No behavior notes in this period.</p>}
          {report.entries.map((i, idx) => (
            <div key={idx} className="bsf-comment">
              <div className="bsf-row-head">
                <strong>{i.studentName}</strong>
                <span
                  className="bsf-status-pill"
                  style={{ background: i.type === "Positive" ? "#E7F0EA" : "#FBEAE8", color: i.type === "Positive" ? "#2F7A5C" : "#B5473B" }}
                >
                  {i.type} · {i.category}
                </span>
              </div>
              <p>{i.description}</p>
            </div>
          ))}
        </>
      )}

      {kind === "transcript" && (
        <>
          <p className="bsf-muted">{report.grade} · Period: {report.periodStart || "Full history"} to {report.periodEnd || "present"}</p>
          <p className="bsf-muted">Generated {report.createdDate}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">GPA</h3>
          <p className="bsf-muted">{report.gpa !== null ? `${report.gpa} average across ${report.entries.length} grade${report.entries.length === 1 ? "" : "s"}` : "Not enough graded entries yet."}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Grade history</h3>
          {report.entries.length === 0 && <p className="bsf-empty">No grades recorded for this student yet.</p>}
          {report.entries.map((e, i) => (
            <div key={i} className="bsf-comment">
              <div className="bsf-row-head">
                <strong>{e.subject}{e.term ? ` · ${e.term}` : ""}</strong>
                <span className="bsf-status-pill" style={{ background: `${LETTER_GRADE_COLOR[e.letter] || "#8A9698"}1A`, color: LETTER_GRADE_COLOR[e.letter] || "#8A9698" }}>
                  {e.scoreType === "Percentage" ? `${e.score}% · ${e.letter}` : e.letter}
                </span>
              </div>
              <p className="bsf-muted">{e.date}</p>
              {e.comments && <p>{e.comments}</p>}
            </div>
          ))}
        </>
      )}
      </div>

      {kind === "standards" && (
        <>
          <p className="bsf-muted">{report.grade} · Period: {report.periodStart || "?"} to {report.periodEnd || "?"}</p>
          <p className="bsf-muted">Generated {report.createdDate}</p>

          <hr className="bsf-divider" />
          {Object.keys(report.byStandard).length === 0 && <p className="bsf-empty">No assessments linked to a standard in this period.</p>}
          {Object.entries(report.byStandard).map(([label, data]) => (
            <div key={label} className="bsf-comment">
              <strong>{label}</strong>
              <div className="bsf-rubric-rows" style={{ marginTop: 6 }}>
                {ASSESS_LEVELS.map((lvl) => (
                  <div key={lvl} className="bsf-rubric-row">
                    <span>{lvl}</span>
                    <span className="bsf-status-pill" style={{ background: `${getLevelColor(lvl)}1A`, color: getLevelColor(lvl) }}>{data[lvl] || 0}</span>
                  </div>
                ))}
              </div>
              <p className="bsf-muted" style={{ marginTop: 6 }}>{data.entries.length} assessment{data.entries.length === 1 ? "" : "s"} linked</p>
            </div>
          ))}
        </>
      )}

      <button className="bsf-btn bsf-btn-block" onClick={() => window.print()}>Print / Save as PDF</button>
      <button className="bsf-textbtn" style={{ marginTop: 10 }} onClick={() => onRemove(report.id)}>Delete this report</button>
    </Modal>
  );
}

const REPORT_KINDS = [
  { id: "student", label: "Student report" },
  { id: "attendance", label: "Attendance report" },
  { id: "assessment", label: "Assessment report" },
  { id: "behavior", label: "Behavior report" },
  { id: "transcript", label: "Transcript" },
  { id: "standards", label: "Standards report" }
];

const GPA_POINTS = { A: 4, B: 3, C: 2, D: 1, F: 0 };

// Composes a starter report comment from a student's actual grades and attendance
// in the given period. This is a smart template, not generative AI, it never invents
// details, it only describes what's genuinely in the data, so the teacher can edit
// and personalize it rather than write the whole thing from a blank page.
function suggestReportComment(data, studentId, studentName, start, end) {
  const firstName = studentName.split(" ")[0];
  const grades = (data.gradeEntries || []).filter((e) => e.studentId === studentId && e.date >= (start || "0000-00-00") && e.date <= (end || "9999-99-99"));
  const attendance = attendanceCountsForRange(data.attendance, studentId, start, end);
  const totalDays = attendance.present + attendance.absent + attendance.late;
  const attendanceRate = totalDays > 0 ? Math.round((attendance.present / totalDays) * 100) : null;

  const parts = [];

  if (grades.length > 0) {
    const bySubject = {};
    grades.forEach((g) => { if (!bySubject[g.subject]) bySubject[g.subject] = []; bySubject[g.subject].push(g); });
    const subjects = Object.keys(bySubject);
    if (subjects.length > 0) {
      parts.push(`${firstName} was assessed this period in ${subjects.join(", ")}.`);
    }
    const levelGrades = grades.filter((g) => g.scoreType === "Levels" && g.letter);
    if (levelGrades.length > 0) {
      const topLevel = levelGrades.some((g) => g.letter === "Confident" || g.letter === "Proficient");
      parts.push(topLevel
        ? `${firstName} is showing strong, consistent progress toward grade-level expectations.`
        : `${firstName} is developing steadily and continuing to build confidence in these skills.`);
    }
    const letterGrades = grades.filter((g) => g.letter && g.scoreType !== "Levels");
    if (letterGrades.length > 0) {
      const strongCount = letterGrades.filter((g) => ["A+", "A", "B+"].includes(g.letter)).length;
      parts.push(strongCount >= letterGrades.length / 2
        ? `Overall academic performance this period has been strong.`
        : `There are some areas that would benefit from extra focus and support going forward.`);
    }
  } else {
    parts.push(`${firstName} has been an active participant in class this period.`);
  }

  if (attendanceRate !== null) {
    parts.push(attendanceRate >= 95
      ? `Attendance has been excellent, at ${attendanceRate}% for this period.`
      : `Attendance was ${attendanceRate}% for this period.`);
  }

  parts.push(`[Add a specific highlight or next step for ${firstName} here.]`);

  return parts.join(" ");
}

function ReportsTab({ data, persist, profile }) {
  const [showForm, setShowForm] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [kind, setKind] = useState("student");
  const settings = data.settings || DEFAULT_SETTINGS;
  const templates = settings.reportCardTemplates && settings.reportCardTemplates.length ? settings.reportCardTemplates : ["Standard Progress Report"];

  const isParent = profile?.role === "parent";
  const linkedIds = profile?.student_ids || [];

  const [form, setForm] = useState({
    studentId: "", template: templates[0], grade: "", subject: "",
    periodStart: "", periodEnd: "", teacherComments: ""
  });
  const [formError, setFormError] = useState("");

  const reports = [...(data.reports || [])]
    .filter((r) => !isParent || ((r.kind === "student" || r.kind === "transcript") && linkedIds.includes(r.studentId)))
    .sort((a, b) => b.createdDate.localeCompare(a.createdDate));
  const viewingReport = reports.find((r) => r.id === viewingId);

  const openForm = (k) => {
    setKind(k);
    setForm({ studentId: "", template: templates[0], grade: "", subject: "", periodStart: "", periodEnd: "", teacherComments: "" });
    setFormError("");
    setShowForm(true);
  };

  const generateStudentReport = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student before generating.");
      return;
    }
    const start = form.periodStart || "0000-00-00";
    const end = form.periodEnd || "9999-99-99";

    const attendanceSummary = { present: 0, absent: 0, late: 0 };
    Object.entries(data.attendance || {}).forEach(([date, day]) => {
      if (date >= start && date <= end) {
        const status = day[student.id];
        if (status) attendanceSummary[status] += 1;
      }
    });

    const assessments = (data.assessments || []).filter((a) => a.studentId === student.id && a.date >= start && a.date <= end);
    const portfolio = data.portfolio.filter((p) => p.studentId === student.id && p.date >= start && p.date <= end);
    const grades = (data.gradeEntries || []).filter((g) => g.studentId === student.id && g.date >= start && g.date <= end);

    const report = {
      id: uid(), kind: "student", studentId: student.id, studentName: student.name, grade: student.grade,
      template: form.template, periodStart: form.periodStart, periodEnd: form.periodEnd,
      teacherComments: form.teacherComments, createdDate: todayStr(), attendanceSummary, assessments, portfolio, grades
    };
    persist({ ...data, reports: [...(data.reports || []), report] });
    setShowForm(false);
    setViewingId(report.id);
  };

  const generateAttendanceReport = () => {
    const start = form.periodStart || "0000-00-00";
    const end = form.periodEnd || "9999-99-99";
    const targetStudents = form.grade ? data.students.filter((s) => s.grade === form.grade) : data.students;

    const rows = targetStudents.map((s) => {
      const counts = { present: 0, absent: 0, late: 0 };
      Object.entries(data.attendance || {}).forEach(([date, day]) => {
        if (date >= start && date <= end) {
          const status = day[s.id];
          if (status) counts[status] += 1;
        }
      });
      return { studentId: s.id, studentName: s.name, ...counts };
    });

    const totals = rows.reduce((acc, r) => ({
      present: acc.present + r.present, absent: acc.absent + r.absent, late: acc.late + r.late
    }), { present: 0, absent: 0, late: 0 });
    const denom = totals.present + totals.absent + totals.late;
    const rate = denom > 0 ? Math.round((totals.present / denom) * 100) : 0;

    const report = {
      id: uid(), kind: "attendance", grade: form.grade || "All grades",
      periodStart: form.periodStart, periodEnd: form.periodEnd, createdDate: todayStr(),
      rows, totals, rate
    };
    persist({ ...data, reports: [...(data.reports || []), report] });
    setShowForm(false);
    setViewingId(report.id);
  };

  const generateAssessmentReport = () => {
    const start = form.periodStart || "0000-00-00";
    const end = form.periodEnd || "9999-99-99";
    const subjectFilter = form.subject.trim().toLowerCase();

    const matches = (data.assessments || []).filter((a) => {
      if (a.date < start || a.date > end) return false;
      if (form.grade && a.grade !== form.grade) return false;
      if (subjectFilter && !(a.subject || "").toLowerCase().includes(subjectFilter)) return false;
      return true;
    });

    const levelCounts = {};
    ASSESS_LEVELS.forEach((l) => { levelCounts[l] = 0; });
    matches.forEach((a) => {
      if (a.rows && a.rows.length > 0) {
        a.rows.forEach((r) => { levelCounts[r.level] = (levelCounts[r.level] || 0) + 1; });
      } else if (a.level) {
        levelCounts[a.level] = (levelCounts[a.level] || 0) + 1;
      }
    });

    const report = {
      id: uid(), kind: "assessment", grade: form.grade || "All grades", subject: form.subject,
      periodStart: form.periodStart, periodEnd: form.periodEnd, createdDate: todayStr(),
      levelCounts, entries: matches
    };
    persist({ ...data, reports: [...(data.reports || []), report] });
    setShowForm(false);
    setViewingId(report.id);
  };

  const generateBehaviorReport = () => {
    const start = form.periodStart || "0000-00-00";
    const end = form.periodEnd || "9999-99-99";

    const matches = (data.behaviorIncidents || []).filter((i) => {
      if (i.date < start || i.date > end) return false;
      if (form.grade && i.grade !== form.grade) return false;
      return true;
    });

    const typeCounts = { Positive: 0, Concern: 0 };
    const categoryCounts = {};
    matches.forEach((i) => {
      typeCounts[i.type] = (typeCounts[i.type] || 0) + 1;
      categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1;
    });

    const report = {
      id: uid(), kind: "behavior", grade: form.grade || "All grades",
      periodStart: form.periodStart, periodEnd: form.periodEnd, createdDate: todayStr(),
      typeCounts, categoryCounts, entries: matches
    };
    persist({ ...data, reports: [...(data.reports || []), report] });
    setShowForm(false);
    setViewingId(report.id);
  };

  const generateTranscriptReport = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student before generating.");
      return;
    }
    const start = form.periodStart || "0000-00-00";
    const end = form.periodEnd || "9999-99-99";

    const entries = (data.gradeEntries || [])
      .filter((e) => e.studentId === student.id && e.date >= start && e.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date));

    const graded = entries.filter((e) => GPA_POINTS[e.letter] !== undefined);
    const gpa = graded.length > 0
      ? (graded.reduce((sum, e) => sum + GPA_POINTS[e.letter], 0) / graded.length).toFixed(2)
      : null;

    const report = {
      id: uid(), kind: "transcript", studentId: student.id, studentName: student.name, grade: student.grade,
      periodStart: form.periodStart, periodEnd: form.periodEnd, createdDate: todayStr(), entries, gpa
    };
    persist({ ...data, reports: [...(data.reports || []), report] });
    setShowForm(false);
    setViewingId(report.id);
  };

  const generateStandardsReport = () => {
    const start = form.periodStart || "0000-00-00";
    const end = form.periodEnd || "9999-99-99";

    const matches = (data.assessments || []).filter((a) => {
      if (!a.standardId) return false;
      if (a.date < start || a.date > end) return false;
      if (form.grade && a.grade !== form.grade) return false;
      return true;
    });

    const byStandard = {};
    matches.forEach((a) => {
      const label = a.standardLabel || "Unnamed standard";
      if (!byStandard[label]) byStandard[label] = { Emerging: 0, Developing: 0, Proficient: 0, Extending: 0, entries: [] };
      if (a.rows && a.rows.length > 0) {
        a.rows.forEach((r) => { byStandard[label][r.level] = (byStandard[label][r.level] || 0) + 1; });
      } else if (a.level) {
        byStandard[label][a.level] = (byStandard[label][a.level] || 0) + 1;
      }
      byStandard[label].entries.push(a);
    });

    const report = {
      id: uid(), kind: "standards", grade: form.grade || "All grades",
      periodStart: form.periodStart, periodEnd: form.periodEnd, createdDate: todayStr(),
      byStandard
    };
    persist({ ...data, reports: [...(data.reports || []), report] });
    setShowForm(false);
    setViewingId(report.id);
  };

  const handleGenerate = () => {
    if (kind === "student") generateStudentReport();
    else if (kind === "attendance") generateAttendanceReport();
    else if (kind === "assessment") generateAssessmentReport();
    else if (kind === "behavior") generateBehaviorReport();
    else if (kind === "transcript") generateTranscriptReport();
    else generateStandardsReport();
  };

  const removeReport = (id) => {
    persist({ ...data, reports: (data.reports || []).filter((r) => r.id !== id) });
    setViewingId(null);
  };

  const kindLabel = (r) => REPORT_KINDS.find((k) => k.id === (r.kind || "student")).label;

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>{isParent ? "Report Cards" : "Reports"}</h1>
        {!isParent && <button className="bsf-btn" onClick={() => openForm("student")} disabled={data.students.length === 0}><Plus size={16} /> Generate</button>}
      </div>
      {!isParent && data.students.length === 0 && <p className="bsf-empty">Add students first, then generate reports here.</p>}
      {isParent && reports.length === 0 && <p className="bsf-empty">No report cards have been generated for your child yet.</p>}

      <section className="bsf-list">
        {!isParent && reports.length === 0 && <p className="bsf-empty">No reports generated yet.</p>}
        {reports.map((r) => (
          <div key={r.id} className="bsf-card bsf-student bsf-clickable" onClick={() => setViewingId(r.id)}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-tag">{kindLabel(r)}</span>
                <span className="bsf-muted">{r.createdDate}</span>
              </div>
              <strong>{r.kind === "student" || !r.kind ? r.studentName : r.grade}</strong>
              <p className="bsf-muted">
                {r.kind === "student" || !r.kind ? r.grade : (r.kind === "assessment" && r.subject ? r.subject : "")}
                {" "}· {r.periodStart || "?"} to {r.periodEnd || "?"}
              </p>
            </div>
            {!isParent && <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeReport(r.id); }} aria-label="Remove"><Trash2 size={16} /></button>}
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title="Generate a report" onClose={() => setShowForm(false)}>
          <Field label="Report type">
            <div className="bsf-chiprow">
              {REPORT_KINDS.map((k) => (
                <button key={k.id} type="button" className={`bsf-chip ${kind === k.id ? "active" : ""}`} onClick={() => setKind(k.id)}>{k.label}</button>
              ))}
            </div>
          </Field>

          {(kind === "student" || kind === "transcript") && (
            <Field label="Student">
              <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                <option value="">Choose a student</option>
                {data.students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
              </select>
            </Field>
          )}
          {kind === "student" && (
            <Field label="Template">
              <select value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })}>
                {templates.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          )}

          {(kind === "attendance" || kind === "assessment" || kind === "behavior" || kind === "standards") && (
            <Field label="Grade">
              <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                <option value="">All grades</option>
                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
          )}

          {kind === "assessment" && (
            <Field label="Subject (optional)">
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Math" />
            </Field>
          )}

          <div className="bsf-two-col">
            <Field label="Period start">
              <input type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} />
            </Field>
            <Field label="Period end">
              <input type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} />
            </Field>
          </div>

          {kind === "student" && (
            <Field label="Teacher comments">
              <textarea rows={4} value={form.teacherComments} onChange={(e) => setForm({ ...form, teacherComments: e.target.value })} placeholder="Overall summary for this period" />
              <button
                type="button"
                className="bsf-textbtn"
                style={{ marginTop: 6 }}
                disabled={!form.studentId}
                onClick={() => {
                  const student = data.students.find((s) => s.id === form.studentId);
                  if (!student) return;
                  setForm({ ...form, teacherComments: suggestReportComment(data, student.id, student.name, form.periodStart, form.periodEnd) });
                }}
              >
                Suggest a starter draft, from this student's actual grades and attendance
              </button>
            </Field>
          )}

          <p className="bsf-muted" style={{ marginBottom: 10 }}>
            {kind === "student" && "Attendance, assessments, and portfolio entries within this date range will be pulled in automatically."}
            {kind === "attendance" && "Present, absent, and late counts for the selected grade and period will be compiled automatically."}
            {kind === "assessment" && "Assessment levels for the selected grade, subject, and period will be compiled automatically."}
            {kind === "behavior" && "Positive notes and concerns for the selected grade and period will be compiled automatically."}
            {kind === "transcript" && "Every grade entry for this student in the selected period, plus a GPA average, will be compiled automatically. Leave dates blank for their full history."}
            {kind === "standards" && "Assessments linked to a standard for the selected grade and period will be grouped by standard automatically."}
          </p>
          <button className="bsf-btn bsf-btn-block" onClick={handleGenerate}>Generate report</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {viewingReport && (
        <ReportViewModal report={viewingReport} data={data} onClose={() => setViewingId(null)} onRemove={isParent ? null : removeReport} />
      )}
    </div>
  );
}

const emptyBehaviorForm = { studentId: "", type: BEHAVIOR_TYPES[0], category: BEHAVIOR_CATEGORIES_POSITIVE[0], description: "", actionTaken: "", reportedBy: "" };

function BehaviorTab({ data, persist }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [gradeFilter, setGradeFilter] = useState(null);
  const [form, setForm] = useState(emptyBehaviorForm);
  const [formError, setFormError] = useState("");

  const incidents = [...(data.behaviorIncidents || [])].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = gradeFilter ? incidents.filter((i) => i.grade === gradeFilter) : incidents;
  const categoryOptions = form.type === "Positive" ? BEHAVIOR_CATEGORIES_POSITIVE : BEHAVIOR_CATEGORIES_CONCERN;

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyBehaviorForm });
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (i) => {
    setEditingId(i.id);
    setForm({ ...emptyBehaviorForm, ...i });
    setFormError("");
    setShowForm(true);
  };

  const setType = (type) => {
    const cats = type === "Positive" ? BEHAVIOR_CATEGORIES_POSITIVE : BEHAVIOR_CATEGORIES_CONCERN;
    setForm({ ...form, type, category: cats[0] });
  };

  const saveIncident = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student before saving.");
      return;
    }
    if (!form.description.trim()) {
      setFormError("Please describe what happened before saving.");
      return;
    }
    const record = { ...form, studentId: student.id, studentName: student.name, grade: student.grade };
    if (editingId) {
      persist({ ...data, behaviorIncidents: (data.behaviorIncidents || []).map((i) => (i.id === editingId ? { ...i, ...record } : i)) });
    } else {
      persist({ ...data, behaviorIncidents: [...(data.behaviorIncidents || []), { id: uid(), date: todayStr(), ...record }] });
      setGradeFilter(null);
    }
    setForm(emptyBehaviorForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeIncident = (id) => persist({ ...data, behaviorIncidents: (data.behaviorIncidents || []).filter((i) => i.id !== id) });

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Behavior</p>
        <h1>{(data.behaviorIncidents || []).length} note{(data.behaviorIncidents || []).length === 1 ? "" : "s"} logged</h1>
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        <button className="bsf-btn" onClick={openAdd} disabled={data.students.length === 0}><Plus size={16} /> Add</button>
      </div>
      {data.students.length === 0 && <p className="bsf-empty">Add students first, then log behavior notes here.</p>}

      {data.students.length > 0 && (
        <section className="bsf-card">
          <h2>Filter by grade</h2>
          <div className="bsf-chiprow">
            <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>All</button>
            {GRADES.map((g) => (
              <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{g}</button>
            ))}
          </div>
        </section>
      )}

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No behavior notes recorded yet.</p>}
        {filtered.map((i) => (
          <div key={i.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEdit(i)}>
            <div>
              <div className="bsf-row-head">
                <span
                  className="bsf-status-pill"
                  style={{
                    background: i.type === "Positive" ? "#E7F0EA" : "#FBEAE8",
                    color: i.type === "Positive" ? "#2F7A5C" : "#B5473B"
                  }}
                >
                  {i.type} · {i.category}
                </span>
                <span className="bsf-muted">{i.date}</span>
              </div>
              <strong>{i.studentName}</strong>
              <p className="bsf-muted">{i.grade}</p>
              <p>{i.description}</p>
              {i.actionTaken && <p className="bsf-muted">Action: {i.actionTaken}</p>}
              {i.reportedBy && <p className="bsf-muted">Reported by: {i.reportedBy}</p>}
            </div>
            <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeIncident(i.id); }} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title={editingId ? "Edit behavior note" : "New behavior note"} onClose={() => setShowForm(false)}>
          <Field label="Student">
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Choose a student</option>
              {data.students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <div className="bsf-chiprow">
              {BEHAVIOR_TYPES.map((t) => (
                <button key={t} type="button" className={`bsf-chip ${form.type === t ? "active" : ""}`} onClick={() => setType(t)}>{t}</button>
              ))}
            </div>
          </Field>
          <Field label="Category">
            <div className="bsf-chiprow">
              {categoryOptions.map((c) => (
                <button key={c} type="button" className={`bsf-chip ${form.category === c ? "active" : ""}`} onClick={() => setForm({ ...form, category: c })}>{c}</button>
              ))}
            </div>
          </Field>
          <Field label="What happened">
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the moment factually" />
          </Field>
          <Field label="Action taken (optional)">
            <textarea rows={2} value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} placeholder="e.g. Spoke with student, notified guardian" />
          </Field>
          <Field label="Reported by">
            <input value={form.reportedBy} onChange={(e) => setForm({ ...form, reportedBy: e.target.value })} placeholder="Teacher name" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveIncident}>{editingId ? "Save changes" : "Save note"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

const emptyGradeForm = { studentId: "", subject: "", term: "", scoreType: "Percentage", score: "", letter: "", standardId: "", comments: "" };

function GradebookTab({ data, persist, profile, onNavigate }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [gradeFilter, setGradeFilter] = useState(null);
  const [showStandards, setShowStandards] = useState(false);
  const [form, setForm] = useState(emptyGradeForm);
  const [formError, setFormError] = useState("");

  const isStudent = profile?.role === "student";
  const myStudentId = isStudent ? (profile.student_ids || [])[0] : null;

  // Pre-N through Kindergarten: portfolio only, no gradebook.
  // Grade 1 and Grade 2: developmental levels only.
  // Grade 3 and up: percentage or letter grades only.
  const scoreTypeForGrade = (grade) => {
    if (grade === "Grade 1" || grade === "Grade 2") return "Levels";
    return "Percentage";
  };

  const entries = [...(data.gradeEntries || [])]
    .filter((e) => !isStudent || e.studentId === myStudentId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const filtered = gradeFilter ? entries.filter((e) => e.grade === gradeFilter) : entries;

  const selectedStudent = data.students.find((s) => s.id === form.studentId);
  const isLevelsGrade = selectedStudent && (selectedStudent.grade === "Grade 1" || selectedStudent.grade === "Grade 2");

  const chooseStudent = (studentId) => {
    const student = data.students.find((s) => s.id === studentId);
    setForm((f) => ({ ...f, studentId, scoreType: student ? scoreTypeForGrade(student.grade) : f.scoreType, letter: "", score: "" }));
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyGradeForm, date: todayStr() });
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (e) => {
    setEditingId(e.id);
    setForm({ ...emptyGradeForm, ...e });
    setFormError("");
    setShowForm(true);
  };

  const saveEntry = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student before saving.");
      return;
    }
    if (!form.subject.trim()) {
      setFormError("Please enter a subject before saving.");
      return;
    }
    const letter = form.scoreType === "Percentage" ? letterFromScore(form.score) : form.letter;
    const standard = (data.standards || []).find((s) => s.id === form.standardId);
    const standardLabel = standard ? (standard.code ? `${standard.code} - ${standard.description}` : standard.description) : "";
    const record = { ...form, studentId: student.id, studentName: student.name, grade: student.grade, letter, standardLabel };
    if (editingId) {
      persist({ ...data, gradeEntries: (data.gradeEntries || []).map((e) => (e.id === editingId ? { ...e, ...record } : e)) });
    } else {
      persist({ ...data, gradeEntries: [...(data.gradeEntries || []), { id: uid(), date: todayStr(), ...record }] });
      setGradeFilter(null);
    }
    setForm(emptyGradeForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeEntry = (id) => persist({ ...data, gradeEntries: (data.gradeEntries || []).filter((e) => e.id !== id) });

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>{isStudent ? "My Grades" : "Gradebook"}</h1>
        {!isStudent && <button className="bsf-btn" onClick={openAdd} disabled={data.students.length === 0}><Plus size={16} /> Add</button>}
      </div>
      {data.students.length === 0 && !isStudent && <p className="bsf-empty">Add students first, then enter grades here.</p>}
      {isStudent && entries.length === 0 && <p className="bsf-empty">No grades entered yet.</p>}

      {!isStudent && (
        <section className="bsf-card">
          <h2>Related tools</h2>
          <div className="bsf-chiprow">
            <button className="bsf-chip" onClick={() => setShowStandards(true)}>Standards library</button>
            <button className="bsf-chip" onClick={() => onNavigate && onNavigate("reports")}>Report Cards</button>
            <button className="bsf-chip" onClick={() => onNavigate && onNavigate("reports")}>Transcripts</button>
          </div>
          <p className="bsf-muted" style={{ marginTop: 8 }}>Report Cards and Transcripts are generated from Reports, using the grades entered here.</p>
        </section>
      )}

      {!isStudent && data.students.length > 0 && (
        <section className="bsf-card">
          <h2>Filter by grade level</h2>
          <div className="bsf-chiprow">
            <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>All</button>
            {GRADES.map((g) => (
              <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{g}</button>
            ))}
          </div>
        </section>
      )}

      <section className="bsf-list">
        {filtered.length === 0 && !isStudent && <p className="bsf-empty">No grades entered yet.</p>}
        {filtered.map((e) => (
          <div key={e.id} className={`bsf-card bsf-student ${isStudent ? "" : "bsf-clickable"}`} onClick={() => { if (!isStudent) openEdit(e); }}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-status-pill" style={{ background: `${LETTER_GRADE_COLOR[e.letter] || "#8A9698"}1A`, color: LETTER_GRADE_COLOR[e.letter] || "#8A9698" }}>
                  {e.scoreType === "Percentage" ? `${e.score}% · ${e.letter}` : e.letter}
                </span>
                <span className="bsf-muted">{e.date}</span>
              </div>
              {!isStudent && <strong>{e.studentName}</strong>}
              <p className="bsf-muted">{e.grade} · {e.subject}{e.term ? ` · ${e.term}` : ""}</p>
              {e.standardLabel && <p className="bsf-muted">Standard: {e.standardLabel}</p>}
              {e.comments && <p>{e.comments}</p>}
            </div>
            {!isStudent && <button className="bsf-iconbtn" onClick={(ev) => { ev.stopPropagation(); removeEntry(e.id); }} aria-label="Remove"><Trash2 size={16} /></button>}
          </div>
        ))}
      </section>

      {showForm && !isStudent && (
        <Modal title={editingId ? "Edit grade" : "New grade entry"} onClose={() => setShowForm(false)}>
          <Field label="Student">
            <select value={form.studentId} onChange={(e) => chooseStudent(e.target.value)}>
              <option value="">Choose a student</option>
              {data.students.filter((s) => GRADES.indexOf(s.grade) >= GRADES.indexOf("Grade 1")).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
            </select>
            <p className="bsf-muted" style={{ marginTop: 4 }}>
              Pre-N through Kindergarten aren't shown here, since those grades are tracked through Portfolio, not the gradebook.
            </p>
          </Field>
          <Field label="Subject">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Math" />
          </Field>
          <Field label="Term or period">
            <input value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} placeholder="e.g. Term 1" />
          </Field>
          {selectedStudent && (
            <p className="bsf-muted" style={{ marginBottom: 10 }}>
              {isLevelsGrade
                ? "Grade 1 and Grade 2 are graded using developmental levels."
                : "Grade 3 and up are graded using percentage or letter grades."}
            </p>
          )}
          {selectedStudent && isLevelsGrade && (
            <Field label="Level">
              <div className="bsf-chiprow">
                {ASSESS_LEVELS.map((l) => (
                  <button key={l} type="button" className={`bsf-chip ${form.letter === l ? "active" : ""}`} onClick={() => setForm({ ...form, letter: l })}>{l}</button>
                ))}
              </div>
            </Field>
          )}
          {selectedStudent && !isLevelsGrade && (
            <Field label="Grade type">
              <div className="bsf-chiprow">
                <button type="button" className={`bsf-chip ${form.scoreType === "Percentage" ? "active" : ""}`} onClick={() => setForm({ ...form, scoreType: "Percentage" })}>Percentage</button>
                <button type="button" className={`bsf-chip ${form.scoreType === "Letter" ? "active" : ""}`} onClick={() => setForm({ ...form, scoreType: "Letter" })}>Letter grade</button>
              </div>
            </Field>
          )}
          {selectedStudent && !isLevelsGrade && (
            form.scoreType === "Percentage" ? (
              <Field label="Score (0 to 100)">
                <input type="number" min="0" max="100" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
                {form.score !== "" && <p className="bsf-muted" style={{ marginTop: 4 }}>Letter grade: {letterFromScore(form.score)}</p>}
              </Field>
            ) : (
              <Field label="Letter grade">
                <div className="bsf-chiprow">
                  {LETTER_GRADES.map((l) => (
                    <button key={l} type="button" className={`bsf-chip ${form.letter === l ? "active" : ""}`} onClick={() => setForm({ ...form, letter: l })}>{l}</button>
                  ))}
                </div>
              </Field>
            )
          )}
          <Field label="Standard (optional)">
            <select value={form.standardId} onChange={(e) => setForm({ ...form, standardId: e.target.value })}>
              <option value="">No specific standard</option>
              {(data.standards || []).map((s) => (
                <option key={s.id} value={s.id}>{s.code ? `${s.code} · ` : ""}{s.subject}{s.grade ? ` · ${s.grade}` : ""}</option>
              ))}
            </select>
          </Field>
          <Field label="Comments">
            <textarea rows={3} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} placeholder="Optional" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveEntry}>{editingId ? "Save changes" : "Save grade"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {showStandards && <StandardsLibraryModal data={data} persist={persist} onClose={() => setShowStandards(false)} />}
    </div>
  );
}

const emptyStaffForm = { name: "", role: STAFF_ROLES[0], position: "", gradesAssigned: [], subjectsTaught: "", email: "", phone: "", startDate: "", notes: "" };

function StaffTab({ data, persist }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [roleFilter, setRoleFilter] = useState(null);
  const [form, setForm] = useState(emptyStaffForm);
  const [formError, setFormError] = useState("");

  const staff = [...(data.staff || [])].sort((a, b) => a.name.localeCompare(b.name));
  const filtered = roleFilter ? staff.filter((s) => s.role === roleFilter) : staff;

  const toggleGrade = (g) => {
    setForm((f) => ({ ...f, gradesAssigned: f.gradesAssigned.includes(g) ? f.gradesAssigned.filter((x) => x !== g) : [...f.gradesAssigned, g] }));
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyStaffForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({ ...emptyStaffForm, ...s });
    setFormError("");
    setShowForm(true);
  };

  const saveStaff = () => {
    if (!form.name.trim()) {
      setFormError("Please enter a name before saving.");
      return;
    }
    if (editingId) {
      persist({ ...data, staff: (data.staff || []).map((s) => (s.id === editingId ? { ...s, ...form } : s)) });
    } else {
      persist({ ...data, staff: [...(data.staff || []), { id: uid(), ...form }] });
      setRoleFilter(null);
    }
    setForm(emptyStaffForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeStaff = (id) => persist({ ...data, staff: (data.staff || []).filter((s) => s.id !== id) });

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Staff</p>
        <h1>{(data.staff || []).length} team member{(data.staff || []).length === 1 ? "" : "s"}</h1>
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>
      </div>

      <section className="bsf-card">
        <h2>Filter by role</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${roleFilter === null ? "active" : ""}`} onClick={() => setRoleFilter(null)}>All</button>
          {STAFF_ROLES.map((r) => (
            <button key={r} className={`bsf-chip ${roleFilter === r ? "active" : ""}`} onClick={() => setRoleFilter(r)}>{r}</button>
          ))}
        </div>
      </section>

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No staff added yet.</p>}
        {filtered.map((s) => (
          <div key={s.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEdit(s)}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-tag">{s.role}</span>
              </div>
              <strong>{s.name}</strong>
              {s.position && <p className="bsf-muted">{s.position}</p>}
              {s.gradesAssigned && s.gradesAssigned.length > 0 && <p className="bsf-muted">{s.gradesAssigned.join(", ")}</p>}
              {s.subjectsTaught && <p className="bsf-muted">{s.subjectsTaught}</p>}
              {(s.email || s.phone) && <p className="bsf-muted">{s.email}{s.email && s.phone ? " · " : ""}{s.phone}</p>}
            </div>
            <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeStaff(s.id); }} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title={editingId ? "Edit staff member" : "Add staff member"} onClose={() => setShowForm(false)}>
          <Field label="Name">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
          </Field>
          <Field label="Role">
            <div className="bsf-chiprow">
              {STAFF_ROLES.map((r) => (
                <button key={r} type="button" className={`bsf-chip ${form.role === r ? "active" : ""}`} onClick={() => setForm({ ...form, role: r })}>{r}</button>
              ))}
            </div>
          </Field>
          <Field label="Position / Title">
            <input
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder={
                form.role === "Administrator" ? "e.g. Director and Principal, Office Manager"
                : form.role === "Support Staff" ? "e.g. School Nurse, IT Support, Cook, Driver"
                : form.role === "Teacher" ? "e.g. Grade 3 Teacher, PE Specialist, Art Specialist"
                : "Specific title for this role"
              }
            />
          </Field>
          {(form.role === "Teacher" || form.role === "Learning Assistant") && (
            <Field label="Grades assigned">
              <div className="bsf-chiprow">
                {GRADES.map((g) => (
                  <button key={g} type="button" className={`bsf-chip ${form.gradesAssigned.includes(g) ? "active" : ""}`} onClick={() => toggleGrade(g)}>{g}</button>
                ))}
              </div>
            </Field>
          )}
          <Field label="Subjects taught (optional)">
            <input value={form.subjectsTaught} onChange={(e) => setForm({ ...form, subjectsTaught: e.target.value })} placeholder="e.g. Math, Science, or PE for specialists" />
          </Field>
          <Field label="Email">
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone or WhatsApp" />
          </Field>
          <Field label="Start date">
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="Notes">
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveStaff}>{editingId ? "Save changes" : "Save staff member"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

const emptyResourceForm = { title: "", category: RESOURCE_CATEGORIES[0], link: "", description: "", files: [], filesFr: [], visibleToParents: false, requiresSignature: false };

function ResourcesTab({ data, persist, profile }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [form, setForm] = useState(emptyResourceForm);
  const [formError, setFormError] = useState("");

  const [signingId, setSigningId] = useState(null);
  const [signatureName, setSignatureName] = useState(profile?.full_name || "");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signatureConfirmed, setSignatureConfirmed] = useState(false);
  const [signatureError, setSignatureError] = useState("");

  const isParent = profile?.role === "parent";

  const openSign = (id) => {
    setSigningId(id);
    setSignatureName(profile?.full_name || "");
    setSignatureDataUrl("");
    setSignatureConfirmed(false);
    setSignatureError("");
  };

  const saveSignature = () => {
    if (!signatureName.trim()) {
      setSignatureError("Please type your full name.");
      return;
    }
    if (!signatureDataUrl) {
      setSignatureError("Please sign in the box above.");
      return;
    }
    if (!signatureConfirmed) {
      setSignatureError("Please confirm you've read the document before signing.");
      return;
    }
    const signature = { id: uid(), parentId: profile.id, parentName: signatureName.trim(), signatureDataUrl, date: todayStr() };
    persist({
      ...data,
      resources: (data.resources || []).map((r) =>
        r.id === signingId ? { ...r, signatures: [...(r.signatures || []).filter((s) => s.parentId !== profile.id), signature] } : r
      )
    });
    setSigningId(null);
  };

  const resources = [...(data.resources || [])]
    .filter((r) => !isParent || r.visibleToParents)
    .sort((a, b) => a.title.localeCompare(b.title));
  const filtered = categoryFilter ? resources.filter((r) => r.category === categoryFilter) : resources;

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyResourceForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (r) => {
    setEditingId(r.id);
    setForm({ ...emptyResourceForm, ...r });
    setFormError("");
    setShowForm(true);
  };

  const saveResource = () => {
    if (!form.title.trim()) {
      setFormError("Please enter a title before saving.");
      return;
    }
    if (editingId) {
      persist({ ...data, resources: (data.resources || []).map((r) => (r.id === editingId ? { ...r, ...form } : r)) });
    } else {
      persist({ ...data, resources: [...(data.resources || []), { id: uid(), date: todayStr(), ...form }] });
      setCategoryFilter(null);
    }
    setForm(emptyResourceForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeResource = (id) => persist({ ...data, resources: (data.resources || []).filter((r) => r.id !== id) });

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Resources</p>
        <h1>{resources.length} file{resources.length === 1 ? "" : "s"} shared</h1>
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        {!isParent && <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>}
      </div>

      <section className="bsf-card">
        <h2>Filter by category</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${categoryFilter === null ? "active" : ""}`} onClick={() => setCategoryFilter(null)}>All</button>
          {(isParent ? PARENT_RESOURCE_CATEGORIES : RESOURCE_CATEGORIES).map((c) => (
            <button key={c} className={`bsf-chip ${categoryFilter === c ? "active" : ""}`} onClick={() => setCategoryFilter(c)}>{c}</button>
          ))}
        </div>
      </section>

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">{isParent ? "No shared documents yet." : "No resources added yet."}</p>}
        {filtered.map((r) => {
          const mySignature = (r.signatures || []).find((s) => s.parentId === profile?.id);
          return (
          <div key={r.id} className="bsf-card bsf-student">
            <div>
              <div className="bsf-row-head">
                <span className="bsf-tag">{r.category}</span>
              </div>
              <strong>{r.title}</strong>
              {r.description && <p>{r.description}</p>}
              {r.link && (
                <a className="bsf-resource-link" href={r.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  {r.link}
                </a>
              )}
              {(r.files || []).length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <p className="bsf-muted" style={{ marginBottom: 2 }}>English</p>
                  <AttachmentField folder="resources" files={r.files} onChange={(files) => persist({ ...data, resources: (data.resources || []).map((x) => (x.id === r.id ? { ...x, files } : x)) })} readOnly={isParent} />
                </div>
              )}
              {(r.filesFr || []).length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <p className="bsf-muted" style={{ marginBottom: 2 }}>Français</p>
                  <AttachmentField folder="resources" files={r.filesFr} onChange={(filesFr) => persist({ ...data, resources: (data.resources || []).map((x) => (x.id === r.id ? { ...x, filesFr } : x)) })} readOnly={isParent} />
                </div>
              )}
              {!isParent && r.requiresSignature && (
                <span className="bsf-minitag" style={{ marginTop: 8, display: "inline-block" }}>{(r.signatures || []).length} signed</span>
              )}
              {isParent && r.requiresSignature && (
                mySignature ? (
                  <p className="bsf-minitag" style={{ marginTop: 8, display: "inline-block" }}>Signed on {mySignature.date}</p>
                ) : (
                  <button className="bsf-btn" style={{ marginTop: 8 }} onClick={() => openSign(r.id)}>Read and sign</button>
                )
              )}
            </div>
            {!isParent && (
              <div className="bsf-student-actions">
                <button className="bsf-iconbtn" onClick={() => openEdit(r)} aria-label="Edit"><FileText size={16} /></button>
                <button className="bsf-iconbtn" onClick={() => removeResource(r.id)} aria-label="Remove"><Trash2 size={16} /></button>
              </div>
            )}
          </div>
          );
        })}
      </section>

      {showForm && !isParent && (
        <Modal title={editingId ? "Edit resource" : "Add resource"} onClose={() => setShowForm(false)}>
          <Field label="Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Parent and Student Handbook" />
          </Field>
          <Field label="Category">
            <div className="bsf-chiprow">
              {RESOURCE_CATEGORIES.map((c) => (
                <button key={c} type="button" className={`bsf-chip ${form.category === c ? "active" : ""}`} onClick={() => setForm({ ...form, category: c })}>{c}</button>
              ))}
            </div>
          </Field>
          <Field label="Link (optional)">
            <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Link to a Google Drive doc, PDF, or website" />
          </Field>
          <Field label="Description">
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
          </Field>
          <Field label="File (English)">
            <AttachmentField folder="resources" files={form.files} onChange={(files) => setForm({ ...form, files })} />
          </Field>
          <Field label="File (Français)">
            <AttachmentField folder="resources" files={form.filesFr} onChange={(filesFr) => setForm({ ...form, filesFr })} />
          </Field>
          <label className="bsf-checkboxrow" style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={form.visibleToParents}
              onChange={(e) => setForm({ ...form, visibleToParents: e.target.checked })}
            />
            <span>Visible to parents (e.g. the Parent and Student Handbook)</span>
          </label>
          {form.visibleToParents && (
            <label className="bsf-checkboxrow" style={{ marginBottom: 14 }}>
              <input
                type="checkbox"
                checked={form.requiresSignature}
                onChange={(e) => setForm({ ...form, requiresSignature: e.target.checked })}
              />
              <span>Requires a signature to acknowledge</span>
            </label>
          )}
          {editingId && (data.resources || []).find((r) => r.id === editingId)?.requiresSignature && (
            <div className="bsf-inlinenote">
              <strong style={{ display: "block", marginBottom: 6 }}>
                {((data.resources || []).find((r) => r.id === editingId)?.signatures || []).length} parent{((data.resources || []).find((r) => r.id === editingId)?.signatures || []).length === 1 ? "" : "s"} signed so far
              </strong>
              {((data.resources || []).find((r) => r.id === editingId)?.signatures || []).map((s) => (
                <p key={s.id} className="bsf-muted" style={{ margin: "2px 0" }}>{s.parentName} · {s.date}</p>
              ))}
            </div>
          )}
          <button className="bsf-btn bsf-btn-block" onClick={saveResource}>{editingId ? "Save changes" : "Save resource"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {signingId && (() => {
        const doc = (data.resources || []).find((r) => r.id === signingId);
        if (!doc) return null;
        return (
          <Modal title={`Sign: ${doc.title}`} onClose={() => setSigningId(null)}>
            <p className="bsf-muted" style={{ marginBottom: 12 }}>
              By signing below, you confirm you have read and understood this document.
            </p>
            <Field label="Your full name">
              <input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} />
            </Field>
            <Field label="Signature">
              <SignaturePad onChange={setSignatureDataUrl} />
            </Field>
            <label className="bsf-checkboxrow" style={{ marginBottom: 14 }}>
              <input type="checkbox" checked={signatureConfirmed} onChange={(e) => setSignatureConfirmed(e.target.checked)} />
              <span>I confirm I have read and understood {doc.title}.</span>
            </label>
            <button className="bsf-btn bsf-btn-block" onClick={saveSignature}>Submit signature</button>
            {signatureError && <p className="bsf-formerror">{signatureError}</p>}
          </Modal>
        );
      })()}
    </div>
  );
}

const emptyChecklistForm = { name: "", category: "", status: ACCRED_STATUSES[0], evidenceLink: "", notes: "" };

const FEE_CATEGORIES = ["Registration", "Tuition", "Other"];
const CURRICULUM_SUBJECTS = ["English Language Arts", "Math", "Unit of Inquiry", "French", "Art", "Music", "Physical Education", "Baseline Assessment"];

// Social Studies and Science were folded into Unit of Inquiry, and the catch-all
// "Other" was replaced by Baseline Assessment. Documents already filed under the
// old names are NOT touched or deleted, they just stop being offered for new
// documents. RETIRED_CURRICULUM_SUBJECTS keeps a filter chip visible for them so
// nothing becomes unreachable in the UI.
const RETIRED_CURRICULUM_SUBJECTS = ["Social Studies", "Science", "Other"];

function BillingTab({ data, persist }) {
  const [studentFilter, setStudentFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleRows, setScheduleRows] = useState({});
  const [form, setForm] = useState({ studentId: "", type: "payment", category: "Tuition", amount: "", description: "", date: todayStr() });
  const [formError, setFormError] = useState("");

  const billing = data.billing || [];
  const students = [...data.students].sort((a, b) => a.name.localeCompare(b.name));

  const balanceForStudent = (studentId) =>
    computeFeeBreakdown(data, studentId).reduce((sum, item) => sum + item.due, 0);

  const feeBreakdownFor = (studentId) => computeFeeBreakdown(data, studentId);

  const openSchedule = (studentId) => {
    const existing = {};
    FEE_CATEGORIES.forEach((cat) => {
      const entry = (data.feeSchedule || []).find((f) => f.studentId === studentId && f.category === cat);
      const listPrice = entry ? (entry.listPrice != null ? entry.listPrice : entry.amountDue) : "";
      existing[cat] = {
        listPrice: listPrice ? String(listPrice) : "",
        discountAmount: entry?.discountAmount ? String(entry.discountAmount) : "",
        discountReason: entry?.discountReason || "",
        waived: !!entry?.waived
      };
    });
    setScheduleRows(existing);
    setShowSchedule(true);
  };

  const updateScheduleRow = (cat, patch) => {
    setScheduleRows({ ...scheduleRows, [cat]: { ...scheduleRows[cat], ...patch } });
  };

  const saveSchedule = () => {
    const withoutThisStudent = (data.feeSchedule || []).filter((f) => f.studentId !== studentFilter);
    const newEntries = FEE_CATEGORIES
      .filter((cat) => (scheduleRows[cat]?.listPrice && Number(scheduleRows[cat].listPrice) > 0) || scheduleRows[cat]?.waived)
      .map((cat) => ({
        id: uid(),
        studentId: studentFilter,
        category: cat,
        listPrice: Number(scheduleRows[cat].listPrice || 0),
        discountAmount: Number(scheduleRows[cat].discountAmount || 0),
        discountReason: scheduleRows[cat].discountReason || "",
        waived: !!scheduleRows[cat].waived
      }));
    persist({ ...data, feeSchedule: [...withoutThisStudent, ...newEntries] });
    setShowSchedule(false);
  };

  const filteredEntries = [...billing]
    .filter((b) => !studentFilter || b.studentId === studentFilter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const addEntry = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student.");
      return;
    }
    const amt = Number(form.amount);
    if (!form.amount || Number.isNaN(amt) || amt <= 0) {
      setFormError("Please enter an amount greater than 0.");
      return;
    }
    const entry = { id: uid(), studentId: student.id, studentName: student.name, type: form.type, category: form.category, amount: amt, description: form.description, date: form.date || todayStr() };
    persist({ ...data, billing: [...billing, entry] });
    setForm({ studentId: "", type: "payment", category: "Tuition", amount: "", description: "", date: todayStr() });
    setFormError("");
    setShowAdd(false);
  };

  const removeEntry = (id) => persist({ ...data, billing: billing.filter((b) => b.id !== id) });

  const totalOwed = students.reduce((sum, s) => sum + Math.max(0, balanceForStudent(s.id)), 0);
  const selectedStudent = students.find((s) => s.id === studentFilter);

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Billing</p>
        <h1>{formatCurrency(totalOwed)} owed school-wide</h1>
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        <button className="bsf-btn" onClick={() => { setFormError(""); setShowAdd(true); }} disabled={students.length === 0}><Plus size={16} /> Add entry</button>
      </div>

      <section className="bsf-card">
        <h2>Select a student</h2>
        <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
          <option value="">All students</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
        </select>
      </section>

      {!studentFilter && (
        <section className="bsf-list">
          <p className="bsf-group-label">Every student, at a glance</p>
          {students.length === 0 && <p className="bsf-empty">Add students first, then track their billing here.</p>}
          {students.map((s) => {
            const bal = balanceForStudent(s.id);
            return (
              <div key={s.id} className="bsf-card bsf-student bsf-clickable" onClick={() => setStudentFilter(s.id)}>
                <StudentThumb photo={s.photo} />
                <div style={{ flex: 1 }}>
                  <strong>{s.name}</strong>
                  <p className="bsf-muted">{s.grade}</p>
                </div>
                <span className="bsf-status-pill" style={{ background: bal > 0 ? "#FCE8E8" : "#E6F2EC", color: bal > 0 ? "#B23A3A" : "#2F7A5C" }}>
                  {formatCurrency(Math.abs(bal))}{bal > 0 ? " due" : bal < 0 ? " credit" : " settled"}
                </span>
              </div>
            );
          })}
        </section>
      )}

      {studentFilter && selectedStudent && (() => {
        const feeItems = feeBreakdownFor(studentFilter);
        const balance = balanceForStudent(studentFilter);
        return (
          <>
            <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
              <span />
              <button className="bsf-btn bsf-btn-ghost" onClick={() => openSchedule(studentFilter)}>Set fee schedule</button>
            </div>
            <section className="bsf-card bsf-invoicecard">
              <div className="bsf-invoicehead">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StudentThumb photo={selectedStudent.photo} />
                  <div>
                    <p className="bsf-eyebrow" style={{ margin: 0 }}>{selectedStudent.name}</p>
                    <p className="bsf-muted" style={{ margin: "2px 0 0" }}>{selectedStudent.grade}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p className="bsf-invoicetotal" style={{ color: balance > 0 ? "#B23A3A" : "#2F7A5C" }}>{formatCurrency(Math.abs(balance))}</p>
                  <p className="bsf-muted" style={{ margin: 0 }}>{balance > 0 ? "Total balance due" : balance < 0 ? "Credit on file" : "Fully settled"}</p>
                </div>
              </div>
              {feeItems.length === 0 ? (
                <p className="bsf-empty">No fee schedule set for this student yet. Tap "Set fee schedule" above to get started.</p>
              ) : (
                <div className="bsf-invoicelines">
                  {feeItems.map((item) => {
                    const statusColor = item.status === "Paid in full" ? "#2F7A5C" : item.status === "Waived" ? "#6B5B95" : item.status === "Partially paid" ? "#B8842F" : item.status === "No fee set" ? "#8A9698" : "#B23A3A";
                    const CatIcon = feeCategoryIcon(item.category);
                    return (
                      <div key={item.category} className="bsf-invoiceline">
                        <div className="bsf-invoiceline-top">
                          <div className="bsf-invoiceline-label">
                            <span className="bsf-invoiceline-icon" style={{ background: `${statusColor}1A`, color: statusColor }}><CatIcon size={15} /></span>
                            <strong>{item.category === "Registration" ? "Registration Fee" : item.category}</strong>
                          </div>
                          <span className="bsf-status-pill" style={{ background: `${statusColor}1A`, color: statusColor }}>{item.status}</span>
                        </div>
                        <div className="bsf-invoicebar"><span style={{ width: `${item.pct}%`, background: statusColor }} /></div>
                        {item.waived ? (
                          <p className="bsf-muted" style={{ margin: "4px 0 0" }}>Real price {formatCurrency(item.listPrice)} · fully waived</p>
                        ) : item.discountAmount > 0 ? (
                          <p className="bsf-muted" style={{ margin: "4px 0 0" }}>
                            Real price {formatCurrency(item.listPrice)} · {formatCurrency(item.discountAmount)} discount{item.discountReason ? ` (${item.discountReason})` : ""}
                          </p>
                        ) : null}
                        <div className="bsf-invoiceline-bottom">
                          <span className="bsf-muted">{formatCurrency(item.paid)} paid of {formatCurrency(item.charged)} owed</span>
                          {item.due > 0 && <span style={{ color: statusColor, fontWeight: 600 }}>{formatCurrency(item.due)} due</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            <p className="bsf-group-label">Full transaction history</p>
          </>
        );
      })()}

      <section className="bsf-list">
        {studentFilter && filteredEntries.length === 0 && <p className="bsf-empty">No transactions recorded for this student yet.</p>}
        {filteredEntries.map((b) => {
          const isPayment = b.type !== "charge";
          return (
          <div key={b.id} className="bsf-card bsf-txnrow">
            <span className="bsf-txnicon" style={{ background: isPayment ? "#E6F2EC" : "#FCE8E8", color: isPayment ? "#2F7A5C" : "#B23A3A" }}>
              {isPayment ? "+" : "−"}
            </span>
            <div style={{ flex: 1 }}>
              {!studentFilter && <strong style={{ display: "block" }}>{b.studentName}</strong>}
              <div className="bsf-row-head">
                <strong style={{ color: isPayment ? "#2F7A5C" : "#B23A3A" }}>{formatCurrency(b.amount)}</strong>
                <span className="bsf-muted">{b.date}</span>
              </div>
              <p className="bsf-muted" style={{ margin: 0 }}>{b.category || "Tuition"}{b.description ? ` · ${b.description}` : ""}</p>
            </div>
            <button className="bsf-iconbtn" onClick={() => removeEntry(b.id)} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
          );
        })}
      </section>

      {showAdd && (
        <Modal title="New billing entry" onClose={() => setShowAdd(false)}>
          <Field label="Student">
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Choose a student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
            </select>
          </Field>
          <Field label="Fee category">
            <div className="bsf-chiprow">
              {FEE_CATEGORIES.map((cat) => (
                <button key={cat} type="button" className={`bsf-chip ${form.category === cat ? "active" : ""}`} onClick={() => setForm({ ...form, category: cat })}>{cat}</button>
              ))}
            </div>
          </Field>
          <Field label="Type">
            <div className="bsf-chiprow">
              <button type="button" className={`bsf-chip ${form.type === "payment" ? "active" : ""}`} onClick={() => setForm({ ...form, type: "payment" })}>Payment received</button>
              <button type="button" className={`bsf-chip ${form.type === "charge" ? "active" : ""}`} onClick={() => setForm({ ...form, type: "charge" })}>Extra charge (e.g. a late fee)</button>
            </div>
            <p className="bsf-muted" style={{ marginTop: 4 }}>
              What's normally owed is set once in "Set fee schedule." Use "Extra charge" only for something additional, like a late fee.
            </p>
          </Field>
          <Field label="Amount (FCFA)">
            <input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 500000" />
          </Field>
          <Field label="Date">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Description (optional)">
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Term 1 tuition, or Mobile money payment" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={addEntry}>Save entry</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {showSchedule && selectedStudent && (
        <Modal title={`Fee schedule: ${selectedStudent.name}`} onClose={() => setShowSchedule(false)}>
          <p className="bsf-muted" style={{ marginBottom: 12 }}>
            Enter the real price for each category, then add a discount or mark it waived if this student doesn't pay full price.
          </p>
          {FEE_CATEGORIES.map((cat) => {
            const row = scheduleRows[cat] || { listPrice: "", discountAmount: "", discountReason: "", waived: false };
            const net = row.waived ? 0 : Math.max(0, Number(row.listPrice || 0) - Number(row.discountAmount || 0));
            return (
              <div key={cat} className="bsf-schedulerow">
                <p className="bsf-group-label" style={{ margin: "0 0 8px" }}>{cat}</p>
                <Field label="Real price (FCFA)">
                  <input
                    type="number" min="0"
                    value={row.listPrice}
                    onChange={(e) => updateScheduleRow(cat, { listPrice: e.target.value })}
                    placeholder="e.g. 150000"
                    disabled={row.waived}
                  />
                </Field>
                <div className="bsf-two-col">
                  <Field label="Discount amount (optional)">
                    <input
                      type="number" min="0"
                      value={row.discountAmount}
                      onChange={(e) => updateScheduleRow(cat, { discountAmount: e.target.value })}
                      placeholder="e.g. 50000"
                      disabled={row.waived}
                    />
                  </Field>
                  <Field label="Discount reason (optional)">
                    <input
                      value={row.discountReason}
                      onChange={(e) => updateScheduleRow(cat, { discountReason: e.target.value })}
                      placeholder="e.g. Sibling discount"
                      disabled={row.waived}
                    />
                  </Field>
                </div>
                <label className="bsf-checkboxrow" style={{ marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={row.waived}
                    onChange={(e) => updateScheduleRow(cat, { waived: e.target.checked })}
                  />
                  <span>Fully waived, this student doesn't owe anything for {cat.toLowerCase()}</span>
                </label>
                {(row.listPrice || row.waived) && (
                  <p className="bsf-muted" style={{ marginTop: 2 }}>
                    {row.waived ? "Waived, 0 FCFA owed" : `They actually owe: ${formatCurrency(net)}${Number(row.discountAmount) > 0 ? ` (${formatCurrency(Number(row.discountAmount))} discount applied)` : ""}`}
                  </p>
                )}
                <hr className="bsf-divider" />
              </div>
            );
          })}
          <button className="bsf-btn bsf-btn-block" onClick={saveSchedule}>Save fee schedule</button>
        </Modal>
      )}
    </div>
  );
}

function AccreditationTab({ data, persist }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyChecklistForm);
  const [formError, setFormError] = useState("");

  const accreditation = data.accreditation || { milestones: [], checklist: [] };
  const milestones = accreditation.milestones || [];
  const checklist = accreditation.checklist || [];

  const loadMilestoneTemplate = () => {
    const seeded = DEFAULT_MILESTONES.map((label) => ({ id: uid(), label, status: ACCRED_STATUSES[0], targetDate: "", notes: "" }));
    persist({ ...data, accreditation: { ...accreditation, milestones: seeded } });
  };

  const updateMilestone = (id, patch) => {
    persist({ ...data, accreditation: { ...accreditation, milestones: milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)) } });
  };

  const removeMilestone = (id) => {
    persist({ ...data, accreditation: { ...accreditation, milestones: milestones.filter((m) => m.id !== id) } });
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyChecklistForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({ ...emptyChecklistForm, ...item });
    setFormError("");
    setShowForm(true);
  };

  const saveChecklistItem = () => {
    if (!form.name.trim()) {
      setFormError("Please enter a name before saving.");
      return;
    }
    if (editingId) {
      persist({ ...data, accreditation: { ...accreditation, checklist: checklist.map((c) => (c.id === editingId ? { ...c, ...form } : c)) } });
    } else {
      persist({ ...data, accreditation: { ...accreditation, checklist: [...checklist, { id: uid(), ...form }] } });
    }
    setForm(emptyChecklistForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeChecklistItem = (id) => {
    persist({ ...data, accreditation: { ...accreditation, checklist: checklist.filter((c) => c.id !== id) } });
  };

  const metCount = checklist.filter((c) => c.status === "Met").length;

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Accreditation</h1>
      </div>

      <section className="bsf-card">
        <div className="bsf-row-head">
          <h2>Candidacy milestones</h2>
          {milestones.length === 0 && (
            <button className="bsf-textbtn" onClick={loadMilestoneTemplate}>Load starter checklist</button>
          )}
        </div>
        {milestones.length === 0 && <p className="bsf-empty">Load the starter checklist to track the standard IB candidacy stages.</p>}
        {milestones.map((m) => (
          <div key={m.id} className="bsf-comment">
            <div className="bsf-row-head">
              <strong>{m.label}</strong>
              <button className="bsf-textbtn" onClick={() => removeMilestone(m.id)}>Remove</button>
            </div>
            <div className="bsf-chiprow" style={{ marginTop: 6 }}>
              {ACCRED_STATUSES.map((s) => (
                <button
                  key={s}
                  className="bsf-chip"
                  style={m.status === s ? { background: ACCRED_STATUS_COLOR[s], borderColor: ACCRED_STATUS_COLOR[s], color: "#fff" } : {}}
                  onClick={() => updateMilestone(m.id, { status: s })}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={m.targetDate}
              onChange={(e) => updateMilestone(m.id, { targetDate: e.target.value })}
              className="bsf-dateinput"
              style={{ marginTop: 8 }}
            />
          </div>
        ))}
      </section>

      <div className="bsf-screen-head">
        <h2 className="bsf-listheading" style={{ margin: 0 }}>Standards checklist ({metCount}/{checklist.length} met)</h2>
        <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>
      </div>
      <section className="bsf-list">
        {checklist.length === 0 && <p className="bsf-empty">Add the specific standards or practices you're tracking toward.</p>}
        {checklist.map((c) => (
          <div key={c.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEdit(c)}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-status-pill" style={{ background: `${ACCRED_STATUS_COLOR[c.status]}1A`, color: ACCRED_STATUS_COLOR[c.status] }}>{c.status}</span>
                {c.category && <span className="bsf-muted">{c.category}</span>}
              </div>
              <strong>{c.name}</strong>
              {c.notes && <p>{c.notes}</p>}
              {c.evidenceLink && <a className="bsf-resource-link" href={c.evidenceLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{c.evidenceLink}</a>}
            </div>
            <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeChecklistItem(c.id); }} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title={editingId ? "Edit checklist item" : "Add checklist item"} onClose={() => setShowForm(false)}>
          <Field label="Standard or practice">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Written curriculum reflects the programme" />
          </Field>
          <Field label="Category (optional)">
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Philosophy, Organization, Curriculum" />
          </Field>
          <Field label="Status">
            <div className="bsf-chiprow">
              {ACCRED_STATUSES.map((s) => (
                <button key={s} type="button" className={`bsf-chip ${form.status === s ? "active" : ""}`} onClick={() => setForm({ ...form, status: s })}>{s}</button>
              ))}
            </div>
          </Field>
          <Field label="Evidence link (optional)">
            <input value={form.evidenceLink} onChange={(e) => setForm({ ...form, evidenceLink: e.target.value })} placeholder="Link to supporting document" />
          </Field>
          <Field label="Notes">
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveChecklistItem}>{editingId ? "Save changes" : "Save item"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

function buildSchoolContext(data) {
  const settings = data.settings || DEFAULT_SETTINGS;
  const counts = {};
  data.students.forEach((s) => { counts[s.grade] = (counts[s.grade] || 0) + 1; });
  const gradeSummary = Object.entries(counts).map(([g, n]) => `${g}: ${n}`).join(", ") || "no students added yet";

  const upcoming = [...(data.events || [])]
    .filter((e) => (e.endDate || e.date) >= todayStr())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)
    .map((e) => `${e.title} (${e.date})`)
    .join("; ") || "none scheduled";

  return `You are the AI Assistant inside BrightSteps Hub, an internal tool for BrightSteps International School in Grand Bassam, Cote d'Ivoire. Today's date is ${todayStr()}.
Curriculum framework: ${settings.curriculumFramework}.
Enrollment by grade: ${gradeSummary}.
Upcoming events: ${upcoming}.

Help the school director and teachers with tasks like drafting parent communications, writing report card comments, summarizing student progress, and answering questions about how to use the hub.
Style rules to always follow when drafting anything for parents or families: never use hyphens or dashes anywhere in the text, always put English before French in any bilingual material, keep a warm and polished international school tone.
Keep answers concise and directly useful. If asked something outside your knowledge of this school, say so plainly rather than guessing.`;
}

function AIAssistantTab({ data }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: buildSchoolContext(data),
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content }))
        })
      });
      const json = await response.json();
      const replyText = (json.content || []).map((c) => (c.type === "text" ? c.text : "")).filter(Boolean).join("\n");
      setMessages((prev) => [...prev, { role: "assistant", content: replyText || "I couldn't generate a response, please try again." }]);
    } catch (e) {
      setError("Something went wrong reaching the assistant. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "Draft a bilingual reminder about the Welcome Coffee",
    "Write a report card comment for a student who is progressing well in reading",
    "Summarize what I should follow up on this week"
  ];

  return (
    <div className="bsf-screen bsf-ai-screen">
      <div className="bsf-screen-head">
        <h1>AI Assistant</h1>
      </div>

      {messages.length === 0 && (
        <section className="bsf-card">
          <h2>Try asking</h2>
          <div className="bsf-chiprow">
            {suggestions.map((s) => (
              <button key={s} className="bsf-chip" onClick={() => setInput(s)}>{s}</button>
            ))}
          </div>
        </section>
      )}

      <div className="bsf-ai-thread">
        {messages.map((m, i) => (
          <div key={i} className={`bsf-ai-bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="bsf-ai-bubble assistant bsf-ai-loading">Thinking…</div>}
        {error && <p className="bsf-formerror">{error}</p>}
      </div>

      <div className="bsf-ai-inputrow">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask the assistant anything about BrightSteps"
        />
        <button className="bsf-iconbtn bsf-ai-sendbtn" onClick={send} disabled={loading} aria-label="Send">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

const FRAMEWORKS = ["Inquiry Based Learning", "IB PYP", "IB MYP", "Common Core", "British National Curriculum", "Other"];

function ListEditor({ label, items, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft("");
  };
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <Field label={label}>
      <div className="bsf-chiprow">
        {items.map((it, i) => (
          <span key={i} className="bsf-chip bsf-editable-chip">
            {it}
            <button type="button" onClick={() => remove(i)} aria-label={`Remove ${it}`}>×</button>
          </span>
        ))}
      </div>
      <div className="bsf-inline-add">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="bsf-btn" onClick={add}>Add</button>
      </div>
    </Field>
  );
}

function LogoUploadField({ logoUrl, onChange }) {
  const [error, setError] = useState("");
  const MAX_SIZE = 3 * 1024 * 1024; // 3MB, plenty for a logo, keeps the school's data light

  const handleFile = (fileList) => {
    setError("");
    const file = (fileList || [])[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG or JPG works best).");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("That image is too large. Please choose one under 3MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.onerror = () => setError("Could not read that file. Please try again.");
    reader.readAsDataURL(file);
  };

  return (
    <div>
      {logoUrl && <img src={logoUrl} alt="School logo preview" className="bsf-logo-preview" />}
      <div style={{ display: "flex", gap: 8 }}>
        <label className="bsf-attachment-upload">
          <Plus size={16} />
          <span>{logoUrl ? "Change logo" : "Upload logo"}</span>
          <input type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files)} />
        </label>
        {logoUrl && (
          <button type="button" className="bsf-btn bsf-btn-ghost" onClick={() => onChange("")}>
            Remove
          </button>
        )}
      </div>
      {error && <p className="bsf-formerror">{error}</p>}
    </div>
  );
}

function SettingsModal({ data, persist, onClose }) {
  const { signOut, profile, updateProfileLocal } = useAuth();
  const { t } = useLanguage();
  const settings = data.settings || DEFAULT_SETTINGS;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [profileFullName, setProfileFullName] = useState(profile?.full_name || "");
  const [profilePhone, setProfilePhone] = useState(profile?.phone || "");
  const [profileNationality, setProfileNationality] = useState(profile?.nationality || "");
  const [profileStatus, setProfileStatus] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const saveMyProfile = async () => {
    setProfileStatus("");
    if (!profileFullName.trim()) {
      setProfileStatus("Please enter your name.");
      return;
    }
    setProfileSaving(true);
    const patch = { full_name: profileFullName.trim(), phone: profilePhone.trim(), nationality: profileNationality.trim() };
    const { error } = await supabase.from("profiles").update(patch).eq("id", profile.id);
    setProfileSaving(false);
    if (error) {
      setProfileStatus(`Could not save: ${error.message}`);
    } else {
      setProfileStatus("Saved.");
      updateProfileLocal(patch);
    }
  };

  const changePassword = async () => {
    setPasswordStatus("");
    if (newPassword.length < 6) {
      setPasswordStatus("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus("Passwords don't match.");
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordStatus("Could not update password. Please try again.");
    } else {
      setPasswordStatus("Password updated.");
      setNewPassword("");
      setConfirmPassword("");
    }
  };
  const update = (patch) => persist({ ...data, settings: { ...settings, ...patch } });
  const updateBranding = (patch) => {
    update({ branding: { ...settings.branding, ...patch } });
    // The logo needs to be visible on the login screen, before anyone signs
    // in. Rather than exposing the whole shared dataset to do that, it lives
    // in its own small, separate row that only ever holds this one thing.
    if (patch.logoUrl !== undefined && window.storage) {
      window.storage.set("brightsteps-hub-logo", patch.logoUrl || "", true);
    }
  };
  const updateYear = (patch) => update({ academicYear: { ...settings.academicYear, ...patch } });

  const isParent = profile?.role === "parent";
  const isAdmin = profile?.role === "admin";

  return (
    <Modal title={isParent ? t("settings.account") : "School settings"} onClose={onClose}>
      {!isParent && (
        <>
      <h3 className="bsf-subheading">Curriculum framework</h3>
      <Field label="Framework">
        <select value={settings.curriculumFramework} onChange={(e) => update({ curriculumFramework: e.target.value })}>
          {FRAMEWORKS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </Field>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Grade structure</h3>
      <ListEditor
        label="Grade levels, in order"
        items={settings.grades}
        onChange={(grades) => update({ grades })}
        placeholder="e.g. Grade 8"
      />

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Assessment scale</h3>
      <ListEditor
        label="Levels, low to high"
        items={settings.assessmentLevels}
        onChange={(assessmentLevels) => update({ assessmentLevels })}
        placeholder="e.g. Mastered"
      />

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">School branding</h3>
      <Field label="Primary color">
        <input type="color" value={settings.branding.primaryColor} onChange={(e) => updateBranding({ primaryColor: e.target.value })} className="bsf-colorinput" />
      </Field>
      <Field label="School logo">
        <LogoUploadField
          logoUrl={settings.branding.logoUrl}
          onChange={(dataUrl) => updateBranding({ logoUrl: dataUrl })}
        />
      </Field>
      <Field label="Mission statement">
        <textarea rows={2} value={settings.branding.mission} onChange={(e) => updateBranding({ mission: e.target.value })} />
      </Field>
      <Field label="Slogan">
        <input value={settings.branding.slogan} onChange={(e) => updateBranding({ slogan: e.target.value })} />
      </Field>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Languages</h3>
      <ListEditor
        label="Languages used at school"
        items={settings.languages}
        onChange={(languages) => update({ languages })}
        placeholder="e.g. Spanish"
      />

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Academic calendar</h3>
      <div className="bsf-two-col">
        <Field label="Year start">
          <input type="date" value={settings.academicYear.startDate} onChange={(e) => updateYear({ startDate: e.target.value })} />
        </Field>
        <Field label="Year end">
          <input type="date" value={settings.academicYear.endDate} onChange={(e) => updateYear({ endDate: e.target.value })} />
        </Field>
      </div>

      <p className="bsf-muted" style={{ marginTop: 12, marginBottom: 8 }}>
        Terms are used to break attendance and report totals down by period, not just the whole year.
      </p>
      {(settings.terms || DEFAULT_SETTINGS.terms).map((term, i) => {
        const updateTerm = (patch) => {
          const nextTerms = [...(settings.terms || DEFAULT_SETTINGS.terms)];
          nextTerms[i] = { ...nextTerms[i], ...patch };
          update({ terms: nextTerms });
        };
        const removeTerm = () => {
          const nextTerms = (settings.terms || DEFAULT_SETTINGS.terms).filter((_, idx) => idx !== i);
          update({ terms: nextTerms });
        };
        return (
          <div key={i} className="bsf-termrow">
            <input
              value={term.name}
              onChange={(e) => updateTerm({ name: e.target.value })}
              className="bsf-termname"
              placeholder="Term name"
            />
            <input type="date" value={term.startDate} onChange={(e) => updateTerm({ startDate: e.target.value })} />
            <input type="date" value={term.endDate} onChange={(e) => updateTerm({ endDate: e.target.value })} />
            <button className="bsf-iconbtn" onClick={removeTerm} aria-label="Remove term"><Trash2 size={16} /></button>
          </div>
        );
      })}
      <button
        type="button"
        className="bsf-btn bsf-btn-ghost"
        onClick={() => update({ terms: [...(settings.terms || DEFAULT_SETTINGS.terms), { name: `Term ${(settings.terms || []).length + 1}`, startDate: "", endDate: "" }] })}
      >
        <Plus size={16} /> Add term
      </button>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Report card templates</h3>
      <ListEditor
        label="Templates"
        items={settings.reportCardTemplates}
        onChange={(reportCardTemplates) => update({ reportCardTemplates })}
        placeholder="e.g. Early Years Narrative Report"
      />

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">User roles</h3>
      <ListEditor
        label="Roles"
        items={settings.roles}
        onChange={(roles) => update({ roles })}
        placeholder="e.g. Coordinator"
      />
      <p className="bsf-muted" style={{ marginTop: 6 }}>Roles are a reference list for now. Real logins and permissions come with hosting.</p>
        </>
      )}

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">My profile</h3>
      <Field label="Full name">
        <input value={profileFullName} onChange={(e) => setProfileFullName(e.target.value)} />
      </Field>
      <Field label="Phone number">
        <input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Nationality">
        <select value={profileNationality} onChange={(e) => setProfileNationality(e.target.value)}>
          <option value="">Prefer not to say</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      {profileStatus && <p className={profileStatus === "Saved." ? "bsf-muted" : "bsf-formerror"}>{profileStatus}</p>}
      <button className="bsf-btn bsf-btn-block bsf-btn-ghost" onClick={saveMyProfile} disabled={profileSaving}>
        {profileSaving ? "Saving..." : "Save profile"}
      </button>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">{t("settings.account")}</h3>
      {profile?.email && <p className="bsf-muted">{t("settings.signedInAs")} {profile.email}</p>}

      <Field label="New password">
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
      </Field>
      <Field label="Confirm new password">
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </Field>
      {passwordStatus && <p className={passwordStatus === "Password updated." ? "bsf-muted" : "bsf-formerror"}>{passwordStatus}</p>}
      <button className="bsf-btn bsf-btn-block bsf-btn-ghost" onClick={changePassword} disabled={passwordSaving || !newPassword}>
        {passwordSaving ? "Updating..." : "Update password"}
      </button>

      {isAdmin && (
        <>
          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Activity Log</h3>
          <p className="bsf-muted" style={{ marginBottom: 12 }}>
            A record of who changed what, and when, across the whole Hub. Keeps the most recent 500 changes.
          </p>
          <div className="bsf-activitylog">
            {(!data.activityLog || data.activityLog.length === 0) && <p className="bsf-empty">No activity recorded yet.</p>}
            {[...(data.activityLog || [])].reverse().slice(0, 100).map((entry) => (
              <div key={entry.id} className="bsf-activityrow">
                <div className="bsf-row-head">
                  <strong>{entry.actorName}</strong>
                  <span className="bsf-muted">{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <p className="bsf-muted" style={{ margin: 0 }}>
                  {entry.actorRole} · updated {entry.areas.join(", ")}
                </p>
              </div>
            ))}
            {data.activityLog && data.activityLog.length > 100 && (
              <p className="bsf-muted" style={{ marginTop: 8 }}>Showing the 100 most recent changes of {data.activityLog.length} recorded.</p>
            )}
          </div>
        </>
      )}

      <button
        className="bsf-btn bsf-btn-block"
        style={{ background: "#801524", marginTop: 10 }}
        onClick={() => { onClose(); signOut(); }}
      >
        {t("settings.signOut")}
      </button>
    </Modal>
  );
}

export default function BrightStepsHub() {
  const { profile } = useAuth();
  return (
    <LanguageProvider role={profile?.role}>
      <BrightStepsHubInner />
    </LanguageProvider>
  );
}

function BrightStepsHubInner() {
  const { profile, signOut } = useAuth();
  const { data, persist: rawPersist, loaded, saving, loadError } = useSchoolData();
  const { t, language, canSwitch, setLanguage } = useLanguage();
  const [tab, setTab] = useState("dashboard");
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const isParent = profile?.role === "parent";
  const isAdmin = profile?.role === "admin";
  const isLearningAssistant = profile?.role === "learning_assistant";
  const isAccountant = profile?.role === "accountant";
  const isViewer = profile?.role === "viewer";
  const isStudent = profile?.role === "student";
  // A Viewer can open and browse every screen in the app, but this makes it
  // impossible for anything they do to actually save, no matter which button,
  // form, or screen they're on. This is enforced once, centrally, rather than
  // trying to individually lock every Add/Edit/Delete control across the app.
  const persist = isViewer
    ? () => { window.alert("Viewer accounts can see everything, but can't make any changes."); }
    : (newData) => {
        const changedAreas = Object.keys(newData)
          .filter((key) => key !== "activityLog" && newData[key] !== data[key])
          .map((key) => ACTIVITY_AREA_LABELS[key] || key);
        if (changedAreas.length === 0) {
          rawPersist(newData);
          return;
        }
        const entry = {
          id: uid(),
          timestamp: new Date().toISOString(),
          actorName: profile?.full_name || profile?.email || "Someone",
          actorRole: profile?.role || "unknown",
          areas: changedAreas
        };
        const existingLog = newData.activityLog || data.activityLog || [];
        rawPersist({ ...newData, activityLog: [...existingLog, entry].slice(-500) });
      };
  const myLinkedStudent = isStudent ? data.students.find((s) => (profile.student_ids || [])[0] === s.id) : null;
  const isUpperStudent = !!myLinkedStudent && GRADES.indexOf(myLinkedStudent.grade) >= GRADES.indexOf("Grade 3");
  const PARENT_HIDDEN_TABS = ["classes", "staff", "admissions", "behavior", "accreditation", "ai", "planning", "gradebook"];
  const ADMIN_ONLY_TABS = ["accreditation","staff","admissions"];
  // Only admin and the accountant role can see billing, everyone else is blocked outright.
  const BILLING_ALLOWED_ROLES = ["admin", "accountant", "viewer"];
  // A learning assistant supports specific grades day to day; they don't need
  // enrollment, staffing, or school-wide admin tools, just the classroom-facing ones.
  const LEARNING_ASSISTANT_ALLOWED_TABS = ["dashboard", "attendance", "portfolio", "assessment", "classes", "calendar", "assignments", "updates", "resources"];
  // An accountant only ever needs billing, nothing about students' academic
  // records, behavior, or staff information.
  const ACCOUNTANT_ALLOWED_TABS = ["dashboard", "billing"];
  // Pre-N through Grade 2: reflections only. Grade 3 and up: can also see (not edit)
  // their own attendance and grades.
  const STUDENT_ALLOWED_TABS = isUpperStudent ? ["portfolio", "attendance", "gradebook", "assignments", "assessment", "messages"] : ["portfolio"];
  const unreadCount = useMemo(() => getUnreadMessageCount(data, profile), [data.students, profile]);

  useEffect(() => {
    if (isParent && PARENT_HIDDEN_TABS.includes(tab)) setTab("dashboard");
    if (!isAdmin && !isViewer && ADMIN_ONLY_TABS.includes(tab)) setTab("dashboard");
    if (tab === "billing" && !BILLING_ALLOWED_ROLES.includes(profile?.role)) setTab("dashboard");
    if (isLearningAssistant && !LEARNING_ASSISTANT_ALLOWED_TABS.includes(tab)) setTab("dashboard");
    if (isAccountant && !ACCOUNTANT_ALLOWED_TABS.includes(tab)) setTab("dashboard");
    if (isStudent && !STUDENT_ALLOWED_TABS.includes(tab)) setTab("portfolio");
  }, [isParent, isAdmin, isLearningAssistant, isAccountant, isStudent, tab, profile]);

  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 380 }}>
          <h2 style={{ color: "#801524" }}>{t("loadError.title")}</h2>
          <p style={{ color: "#555" }}>
            {t("loadError.body")}
          </p>
          <button className="bsf-btn" onClick={() => window.location.reload()}>{t("loadError.reload")}</button>
        </div>
      </div>
    );
  }

  const branding = (data.settings || DEFAULT_SETTINGS).branding;

  const allSectionsRaw = [
    { id: "dashboard", label: "Dashboard", navKey: "nav.dashboard", icon: LayoutDashboard, category: "core" },
    { id: "students", label: "Students", navKey: "nav.students", icon: Users, category: "classroom" },
    { id: "classes", label: "Classes", navKey: "nav.classes", icon: UserCheck, category: "classroom" },
    { id: "staff", label: "Staff", navKey: "nav.staff", icon: Briefcase, category: "office" },
    { id: "attendance", label: "Attendance", navKey: "nav.attendance", icon: CheckSquare, category: "core" },
    { id: "portfolio", label: "Portfolio", navKey: "nav.portfolio", icon: BookOpen, category: "core" },
    { id: "assessment", label: "Assessment", navKey: "nav.assessment", icon: ClipboardCheck, category: "core" },
    { id: "gradebook", label: "Gradebook", navKey: "nav.gradebook", icon: Percent, category: "classroom" },
    { id: "planning", label: "Curriculum", navKey: "nav.planning", icon: ClipboardList, category: "classroom" },
    { id: "calendar", label: "Calendar", navKey: "nav.calendar", icon: CalendarIcon, category: "office" },
    { id: "canteen", label: "Canteen", navKey: "nav.canteen", icon: Utensils, category: "office" },
    { id: "admissions", label: "Admissions", navKey: "nav.admissions", icon: UserPlus, category: "office" },
    { id: "assignments", label: "Assignments", navKey: "nav.assignments", icon: FileText, category: "classroom" },
    { id: "reports", label: "Reports", navKey: "nav.reports", icon: FileCheck, category: "compliance" },
    { id: "resources", label: "Resources", navKey: "nav.resources", icon: FolderOpen, category: "compliance" },
    { id: "accreditation", label: "Accreditation", navKey: "nav.accreditation", icon: Award, category: "compliance" },
    { id: "billing", label: "Billing", navKey: "nav.billing", icon: Wallet, category: "office" },
    { id: "ai", label: "AI Assistant", navKey: "nav.ai", icon: Sparkles, hidden: true, category: "office" },
    { id: "updates", label: "Communication", navKey: "nav.updates", icon: Megaphone, category: "office" }
  ];
  const allSections = allSectionsRaw
    .filter((s) => !s.hidden)
    .filter((s) => !isParent || !PARENT_HIDDEN_TABS.includes(s.id))
    .filter((s) => isAdmin || isViewer || !ADMIN_ONLY_TABS.includes(s.id))
    .filter((s) => s.id !== "billing" || BILLING_ALLOWED_ROLES.includes(profile?.role))
    .filter((s) => !isLearningAssistant || LEARNING_ASSISTANT_ALLOWED_TABS.includes(s.id))
    .filter((s) => !isAccountant || ACCOUNTANT_ALLOWED_TABS.includes(s.id))
    .filter((s) => !isStudent || STUDENT_ALLOWED_TABS.includes(s.id));

  const primaryIds = isStudent
    ? STUDENT_ALLOWED_TABS.filter((id) => id !== "messages")
    : isAccountant
    ? ACCOUNTANT_ALLOWED_TABS
    : ["dashboard", "attendance", "portfolio", "assessment"];
  const bottomTabs = primaryIds.map((id) => allSections.find((s) => s.id === id)).filter(Boolean);
  if (isStudent && isUpperStudent) {
    bottomTabs.push({ id: "messages", label: "Messages", icon: Megaphone });
  }

  const goTo = (id) => {
    setTab(id);
    setShowMenu(false);
  };

  return (
    <div className="bsf-app" style={{ "--teal": branding.primaryColor, "--gold": branding.primaryColor }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;0,700;1,500&family=Work+Sans:wght@400;500;600;700&display=swap');

        .bsf-app {
          --ink: #241012;
          --teal: #801524;
          --teal-light: #A02E3B;
          --sand: #FBF7F3;
          --sand-deep: #F5E4E6;
          --gold: #C9A227;
          --gold-dark: #8A6A2E;
          --line: #EAD7DA;
          --white: #FFFFFF;
          --shadow-sm: 0 1px 3px rgba(36, 16, 18, 0.06), 0 1px 2px rgba(36, 16, 18, 0.04);
          --shadow-md: 0 8px 24px rgba(36, 16, 18, 0.10), 0 2px 6px rgba(36, 16, 18, 0.06);
          --shadow-lift: 0 14px 32px rgba(36, 16, 18, 0.14), 0 4px 10px rgba(36, 16, 18, 0.08);
          font-family: 'Work Sans', sans-serif;
          background: var(--sand);
          color: var(--ink);
          min-height: 100vh;
          max-width: 480px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .bsf-app h1, .bsf-app h2 { font-family: 'Fraunces', serif; margin: 0; }
        .bsf-app * { box-sizing: border-box; }

        @media (min-width: 768px) {
          .bsf-app {
            max-width: 900px;
          }
        }
        @media (min-width: 1200px) {
          .bsf-app {
            max-width: 1100px;
          }
        }

        .bsf-topbar {
          padding: 18px 20px 12px;
          background: linear-gradient(135deg, var(--teal) 0%, var(--teal-light) 130%);
          color: var(--white);
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 4px 16px rgba(36, 16, 18, 0.18);
          position: relative;
          z-index: 2;
        }
        .bsf-brand { display: flex; align-items: center; gap: 10px; }
        .bsf-topbar-logo { width: 32px; height: 32px; border-radius: 8px; object-fit: cover; background: var(--white); }
        .bsf-wordmark { font-family: 'Fraunces', serif; font-weight: 700; font-size: 20px; letter-spacing: 0.2px; }
        .bsf-slogan { font-size: 11px; color: #F0D9DD; margin-top: 2px; }
        .bsf-topbar-actions { display: flex; align-items: center; gap: 10px; }
        .bsf-savestate { font-size: 11px; color: #F0D9DD; opacity: 0.85; }
        .bsf-topbar .bsf-settingsbtn { color: var(--white); }
        .bsf-settingsbtn:hover { background: rgba(255,255,255,0.15); }

        .bsf-screen { padding: 16px 16px 90px; flex: 1; overflow-y: auto; }

        .bsf-hero {
          padding: 20px 18px;
          margin-bottom: 14px;
          background: linear-gradient(160deg, var(--white) 0%, var(--sand-deep) 160%);
          border-radius: 18px;
          box-shadow: var(--shadow-sm);
        }
        .bsf-eyebrow { font-size: 11.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold-dark); font-weight: 700; margin: 0 0 6px; }
        .bsf-hero h1 { font-size: 27px; line-height: 1.15; font-weight: 600; }
        .bsf-hero-sub { margin: 8px 0 0; color: var(--teal-light); font-weight: 500; }
        .bsf-hero-names { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600; color: var(--ink); }

        .bsf-avatar-stack { display: flex; align-items: center; }
        .bsf-avatar-stack-item {
          margin-left: -10px; border: 2.5px solid var(--white); border-radius: 50%;
          box-shadow: var(--shadow-sm); background: var(--white);
        }
        .bsf-avatar-stack-item:first-child { margin-left: 0; }
        .bsf-avatar-stack-item .bsf-student-thumb { width: 38px; height: 38px; }
        .bsf-avatar-stack-more {
          margin-left: -10px; width: 38px; height: 38px; border-radius: 50%;
          background: var(--sand-deep); color: var(--gold-dark); border: 2.5px solid var(--white);
          display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;
        }

        .bsf-stairs-card { padding-bottom: 20px; }
        .bsf-stairs {
          display: flex; align-items: flex-end; gap: 5px; height: 130px; margin-top: 8px;
          padding: 0 2px;
        }
        .bsf-stair { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
        .bsf-stair-count { font-size: 10.5px; font-weight: 700; color: #8A9698; margin-bottom: 4px; height: 13px; }
        .bsf-stair-bar {
          width: 100%; max-width: 30px; border-radius: 7px 7px 3px 3px;
          background: linear-gradient(180deg, var(--teal-light) 0%, var(--teal) 100%);
          transition: height 0.4s ease;
        }
        .bsf-stair-label { font-size: 9.5px; font-weight: 600; color: #8A9698; margin-top: 6px; white-space: nowrap; }
        .bsf-tiletoggle { display: flex; background: var(--sand-deep); border-radius: 12px; padding: 3px; margin-bottom: 16px; }
        .bsf-tiletoggle-btn {
          flex: 1; padding: 9px 10px; border-radius: 9px; border: none; background: transparent;
          font-size: 13.5px; font-weight: 600; color: var(--gold-dark); cursor: pointer;
        }
        .bsf-tiletoggle-btn.active { background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); }
        .bsf-stair-interactive { background: none; border: none; cursor: pointer; padding: 0; font-family: inherit; }
        .bsf-stair-interactive .bsf-stair-bar { transition: height 0.4s ease, opacity 0.15s ease; opacity: 0.55; }
        .bsf-stair-interactive:hover .bsf-stair-bar { opacity: 0.8; }
        .bsf-stair-interactive.active .bsf-stair-bar { opacity: 1; }
        .bsf-stair-interactive.active .bsf-stair-label { color: var(--teal); }

        .bsf-dashboard-grid { display: flex; flex-direction: column; gap: 14px; }
        .bsf-dashboard-grid .bsf-card { margin-bottom: 0; }
        @media (min-width: 640px) {
          .bsf-dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        }

        .bsf-portfolio-row { display: flex; align-items: flex-start; gap: 10px; }
        .bsf-portfolio-entry { display: flex; align-items: flex-start; gap: 12px; }
        .bsf-reactionrow { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
        .bsf-reactbtn {
          display: flex; align-items: center; gap: 5px; background: var(--sand-deep);
          border: none; border-radius: 100px; padding: 5px 11px; font-size: 13px;
          font-weight: 600; color: var(--ink); cursor: pointer; transition: transform 0.1s ease;
        }
        .bsf-reactbtn:active { transform: scale(0.94); }
        .bsf-reactbtn.active { background: #FCE8E8; }
        .bsf-reactionnames { font-size: 12px; }

        .bsf-screen-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding: 4px; }
        .bsf-screen-head-wrap { flex-wrap: wrap; row-gap: 10px; }
        .bsf-screen-head-actions { display: flex; gap: 8px; flex-wrap: wrap; width: 100%; }
        @media (min-width: 420px) {
          .bsf-screen-head-actions { width: auto; }
        }
        .bsf-screen-head h1 { font-size: 22px; font-weight: 600; }

        .bsf-card {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 14px;
          box-shadow: var(--shadow-sm);
          transition: box-shadow 0.18s ease, transform 0.18s ease;
        }
        .bsf-card.bsf-clickable:hover, .bsf-card.bsf-clickable:active {
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }
        .bsf-card h2 { font-size: 16px; font-weight: 600; margin-bottom: 10px; }

        .bsf-row { display: flex; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line); }
        .bsf-row:first-of-type { border-top: none; padding-top: 0; }
        .bsf-row p { margin: 2px 0 0; font-size: 14px; color: #3B4A4C; }
        .bsf-row-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }

        .bsf-list { display: flex; flex-direction: column; }
        .bsf-student { display: flex; align-items: flex-start; gap: 8px; text-align: left; }
        .bsf-student > div:not(.bsf-student-actions):not(.bsf-student-thumb) { flex: 1; min-width: 0; text-align: left; }
        .bsf-student-actions { margin-left: auto; flex-shrink: 0; display: flex; gap: 2px; }
        .bsf-student p { margin: 2px 0 0; font-size: 13px; }

        .bsf-tag {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          background: var(--sand-deep);
          color: var(--gold-dark);
          padding: 3px 9px;
          border-radius: 100px;
          white-space: nowrap;
        }
        .bsf-tag-alert { background: #FCE8E8; color: #B23A3A; margin-top: 4px; }
        .bsf-checkboxrow { display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer; }
        .bsf-signaturepad {
          width: 100%; height: 140px; background: #FCFAF4; border: 1.5px dashed var(--line);
          border-radius: 12px; touch-action: none; cursor: crosshair;
        }
        .bsf-group-label {
          font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--gold-dark); margin: 4px 4px 8px;
        }
        .bsf-mysubmission textarea { margin-bottom: 8px; }
        .bsf-inlinenote {
          background: var(--sand-deep); border-radius: 10px; padding: 8px 12px;
          font-size: 12px; color: var(--ink); margin-bottom: 14px;
        }
        .bsf-inlinenote code { font-size: 11px; background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 4px; }
        .bsf-muted { color: #6E7B7D; font-size: 12px; }
        .bsf-empty { color: #6E7B7D; font-size: 14px; padding: 8px 2px; }

        .bsf-fr-block { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--line); }

        .bsf-btn {
          background: var(--teal);
          color: var(--white);
          border: none;
          border-radius: 10px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(128, 21, 36, 0.28);
          transition: box-shadow 0.15s ease, transform 0.15s ease;
        }
        .bsf-btn:hover { box-shadow: 0 4px 12px rgba(128, 21, 36, 0.34); transform: translateY(-1px); }
        .bsf-btn:active { transform: translateY(0); }
        .bsf-btn:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; transform: none; }
        .bsf-btn-block { width: 100%; justify-content: center; margin-top: 6px; }
        .bsf-iconbtn {
          background: transparent;
          border: none;
          color: #8A6A2E;
          cursor: pointer;
          padding: 4px;
          border-radius: 8px;
        }
        .bsf-iconbtn:hover { background: var(--sand-deep); }

        .bsf-ladder { display: flex; flex-direction: column; gap: 9px; }
        .bsf-rung {
          display: grid;
          grid-template-columns: 78px 1fr 22px;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 4px 6px;
          cursor: pointer;
          text-align: left;
        }
        .bsf-rung.active { border-color: var(--teal-light); background: var(--sand-deep); }
        .bsf-rung-label { font-size: 12px; color: var(--ink); font-weight: 500; }
        .bsf-rung-track { height: 8px; background: var(--sand-deep); border-radius: 6px; overflow: hidden; }
        .bsf-rung-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--teal-light), var(--teal)); border-radius: 6px; }
        .bsf-rung-count { font-size: 12px; color: #6E7B7D; text-align: right; }

        .bsf-tabbar {
          position: sticky;
          bottom: 8px;
          margin: 0 10px calc(8px + env(safe-area-inset-bottom));
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(12px);
          border-radius: 22px;
          display: flex;
          gap: 2px;
          padding: 6px;
          box-shadow: 0 14px 34px rgba(36, 16, 18, 0.16), 0 2px 8px rgba(36, 16, 18, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.7);
        }
        .bsf-tab {
          flex: 1;
          background: none;
          border: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 8px 2px;
          color: #8A9698;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 15px;
          transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }
        .bsf-tab.active {
          color: #fff;
          background: linear-gradient(135deg, #801524, #A02E3B);
          box-shadow: 0 6px 16px rgba(128, 21, 36, 0.35);
          transform: translateY(-3px);
        }

        .bsf-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(43, 18, 22, 0.45);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: flex-end;
          z-index: 40;
        }
        .bsf-modal {
          background: var(--white);
          width: 100%;
          max-height: 85vh;
          overflow-y: auto;
          border-radius: 20px 20px 0 0;
          padding: 18px 18px 24px;
          box-shadow: var(--shadow-lift);
        }
        .bsf-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .bsf-modal-head h3 { font-family: 'Fraunces', serif; font-size: 19px; font-weight: 600; }

        .bsf-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; font-size: 13px; font-weight: 600; color: #3B4A4C; }
        .bsf-field input, .bsf-field select, .bsf-field textarea {
          font-family: 'Work Sans', sans-serif;
          font-weight: 400;
          font-size: 14px;
          padding: 9px 10px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: #FCFAF4;
          color: var(--ink);
        }
        .bsf-field textarea { resize: vertical; }
        .bsf-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .bsf-termrow {
          display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 8px; align-items: center;
          margin-bottom: 8px;
        }
        .bsf-termsummary { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); }
        .bsf-termsummary-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
        .bsf-childstats { display: flex; gap: 20px; flex-wrap: wrap; padding-top: 8px; border-top: 1px solid var(--line); }
        .bsf-childstat { display: flex; flex-direction: column; gap: 2px; }
        .bsf-childstat strong { font-size: 15px; }
        .bsf-invoicecard {
          border: none;
          background: linear-gradient(165deg, #FFFFFF 0%, #FBF3F0 100%);
          box-shadow: var(--shadow-lift);
          padding: 18px;
        }
        .bsf-invoicehead {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--line);
        }
        .bsf-invoicetotal { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 600; margin: 0; line-height: 1.1; }
        .bsf-invoicelines { display: flex; flex-direction: column; gap: 16px; }
        .bsf-invoiceline-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .bsf-invoiceline-label { display: flex; align-items: center; gap: 8px; }
        .bsf-invoiceline-icon {
          width: 26px; height: 26px; border-radius: 8px; display: flex;
          align-items: center; justify-content: center; flex-shrink: 0;
        }
        .bsf-txnrow { display: flex; align-items: flex-start; gap: 12px; }
        .bsf-txnicon {
          width: 30px; height: 30px; border-radius: 50%; display: flex;
          align-items: center; justify-content: center; flex-shrink: 0;
          font-weight: 700; font-size: 16px; line-height: 1;
        }
        .bsf-schedulerow { margin-bottom: 6px; }
        .bsf-activitylog { max-height: 360px; overflow-y: auto; }
        .bsf-activityrow { padding: 10px 0; border-bottom: 1px solid var(--line); }
        .bsf-activityrow:last-child { border-bottom: none; }
        .bsf-invoicebar { height: 6px; border-radius: 4px; background: var(--sand-deep); overflow: hidden; margin-bottom: 6px; }
        .bsf-invoicebar span { display: block; height: 100%; border-radius: 4px; transition: width 0.4s ease; }
        .bsf-invoiceline-bottom { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; }
        .bsf-termsummary-row:last-child { margin-bottom: 0; }
        .bsf-termname { font-size: 13px; }
        @media (max-width: 420px) {
          .bsf-termrow { grid-template-columns: 1fr 1fr; }
          .bsf-termname { grid-column: 1 / -1; }
        }

        .bsf-dateinput {
          font-family: 'Work Sans', sans-serif;
          font-size: 13px;
          padding: 7px 9px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: var(--white);
          color: var(--ink);
        }
        .bsf-chiprow { display: flex; flex-wrap: wrap; gap: 7px; }
        .bsf-chip {
          font-size: 12px;
          font-weight: 600;
          padding: 6px 11px;
          border-radius: 100px;
          border: 1px solid var(--line);
          background: var(--white);
          color: #3B4A4C;
          cursor: pointer;
        }
        .bsf-chip.active { background: var(--teal); border-color: var(--teal); color: var(--white); }
        .bsf-attend-row {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          text-align: left;
          font-family: 'Work Sans', sans-serif;
          cursor: pointer;
        }
        .bsf-attend-row span:nth-child(2) { flex: 1; }
        .bsf-attend-summary { margin-top: 16px; }
        .bsf-attend-bignum { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
        .bsf-attend-bignum strong { font-family: 'Fraunces', serif; font-size: 32px; color: var(--teal); font-weight: 600; }
        .bsf-attend-bignum span { font-size: 13px; color: var(--teal-light); font-weight: 500; }
        .bsf-attend-segbar { display: flex; height: 8px; border-radius: 6px; overflow: hidden; background: var(--sand-deep); }
        .bsf-attend-segbar span { display: block; }
        .bsf-status-pill {
          font-size: 12px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 100px;
          white-space: nowrap;
        }
        .bsf-templatebtn {
          width: 100%;
          background: var(--sand-deep);
          color: var(--gold-dark);
          border: 1px dashed var(--teal);
          border-radius: 10px;
          padding: 9px 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 14px;
        }
        .bsf-loi { white-space: pre-line; }
        .bsf-author-badge {
          font-size: 10.5px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 100px;
          white-space: nowrap;
        }
        .bsf-author-badge.teacher { background: var(--sand-deep); color: var(--gold-dark); }
        .bsf-author-badge.student { background: #E7F0EA; color: #2F7A5C; }
        .bsf-clickable { cursor: pointer; }
        .bsf-checklist { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; border: 1px solid var(--line); border-radius: 10px; padding: 8px; }
        .bsf-checklist-row { display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 4px 2px; }
        .bsf-checklist-row input { flex-shrink: 0; }
        .bsf-minitag {
          font-size: 10.5px;
          font-weight: 600;
          background: var(--sand-deep);
          color: var(--gold-dark);
          padding: 3px 8px;
          border-radius: 100px;
        }
        .bsf-status-chips { margin-top: 8px; gap: 6px; }
        .bsf-divider { border: none; border-top: 1px solid var(--line); margin: 16px 0; }
        .bsf-subheading { font-family: 'Fraunces', serif; font-size: 15px; font-weight: 600; margin: 0 0 8px; }
        .bsf-comments { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
        .bsf-comment { background: #FCFAF4; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
        .bsf-comment p { margin: 4px 0 6px; font-size: 13px; }

        .bsf-msg-header { margin-bottom: 10px; }
        .bsf-msg-header .bsf-muted { margin-top: 3px; }

        .bsf-chatthread {
          display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;
          max-height: 420px; overflow-y: auto; padding: 4px 2px;
        }
        .bsf-chatdate {
          text-align: center; font-size: 11px; font-weight: 600; color: #A69698;
          margin: 12px 0 8px; text-transform: uppercase; letter-spacing: 0.04em;
        }
        .bsf-chatdate:first-child { margin-top: 0; }
        .bsf-chatrow { display: flex; justify-content: flex-start; align-items: flex-end; gap: 8px; margin-bottom: 6px; }
        .bsf-chatrow.mine { justify-content: flex-end; }
        .bsf-chatavatar {
          flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%;
          background: var(--sand-deep); color: var(--gold-dark);
          display: flex; align-items: center; justify-content: center;
          font-size: 10.5px; font-weight: 700;
        }
        .bsf-chatbubble {
          position: relative;
          max-width: 74%; background: #F2EFE8; border-radius: 16px 16px 16px 4px;
          padding: 8px 30px 8px 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .bsf-chatrow.mine .bsf-chatbubble {
          background: var(--teal); color: #fff; border-radius: 16px 16px 4px 16px;
          padding: 8px 12px;
        }
        .bsf-chatauthor { font-size: 11px; font-weight: 700; color: var(--teal); margin-bottom: 2px; }
        .bsf-chatbubble p { margin: 0; font-size: 14px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
        .bsf-chatremove {
          position: absolute; top: 6px; right: 6px; background: none; border: none;
          color: #A69698; opacity: 0.55; transition: opacity 0.15s ease; cursor: pointer;
          padding: 2px; border-radius: 50%; display: flex;
        }
        .bsf-chatbubble:hover .bsf-chatremove { opacity: 1; }
        .bsf-chatremove:hover { background: rgba(0,0,0,0.08); }
        .bsf-chatrow.mine .bsf-chatremove { color: rgba(255,255,255,0.8); }
        .bsf-chatinputbar {
          display: flex; align-items: flex-end; gap: 8px;
          background: #FCFAF4; border: 1px solid var(--line); border-radius: 22px;
          padding: 6px 6px 6px 14px; margin-bottom: 16px;
        }
        .bsf-chatinputbar textarea {
          flex: 1; border: none; background: transparent; resize: none; outline: none;
          font-size: 14px; line-height: 1.4; padding: 6px 0; max-height: 100px; font-family: inherit;
        }
        .bsf-chatsendbtn {
          flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%; border: none;
          background: #801524; color: #fff; display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .bsf-chatsendbtn:disabled { opacity: 0.4; cursor: not-allowed; }
        .bsf-textbtn {
          background: none;
          border: none;
          color: var(--gold-dark);
          font-size: 12px;
          font-weight: 600;
          padding: 0;
          cursor: pointer;
        }
        .bsf-btn-ghost {
          background: var(--white);
          color: var(--teal);
          border: 1px solid var(--line);
        }
        .bsf-rubric-items { margin: 4px 0 0; padding-left: 18px; font-size: 13px; }
        .bsf-rubric-items li { margin-bottom: 2px; }
        .bsf-rubric-rows { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
        .bsf-rubric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          padding: 4px 0;
          border-top: 1px dashed var(--line);
        }
        .bsf-rubric-form { display: flex; flex-direction: column; gap: 12px; margin-bottom: 12px; }
        .bsf-rubric-form-row { background: #FCFAF4; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
        .bsf-rubric-form-label { font-size: 13px; font-weight: 600; margin: 0 0 8px; color: var(--ink); }
        .bsf-mission { font-style: italic; color: var(--teal-light); margin: 10px 0 0; font-size: 14px; }

        .bsf-letterhead { text-align: center; margin-bottom: 20px; }
        .bsf-letterhead-logo { width: 56px; height: 56px; object-fit: contain; margin-bottom: 8px; }
        .bsf-letterhead h2 { font-family: 'Fraunces', serif; font-size: 20px; margin: 0 0 2px; }
        .bsf-letterhead-table { width: 100%; margin-top: 14px; border-collapse: collapse; text-align: left; font-size: 13px; }
        .bsf-letterhead-table td { padding: 5px 8px; border: 1px solid var(--line); }
        .bsf-letterhead-table td:first-child { font-weight: 600; width: 40%; background: var(--sand-deep); }
        .bsf-letterhead-legend {
          text-align: left; margin-top: 16px; padding: 12px 14px; background: var(--sand-deep);
          border-radius: 10px; font-size: 12.5px; line-height: 1.6;
        }
        .bsf-letterhead-legend strong { display: block; margin-bottom: 4px; color: var(--gold-dark); }
        .bsf-letterhead-legend p { margin: 0; }
        .bsf-signatureblock { display: flex; gap: 24px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 13px; flex-wrap: wrap; }

        @media print {
          body * { visibility: hidden; }
          .bsf-printable, .bsf-printable * { visibility: visible; }
          .bsf-printable { position: absolute; top: 0; left: 0; width: 100%; padding: 20px; }
          .bsf-noprint { display: none !important; }
        }
        .bsf-editable-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--sand-deep);
          color: var(--gold-dark);
          border-color: transparent;
          cursor: default;
        }
        .bsf-editable-chip button {
          background: none;
          border: none;
          color: var(--gold-dark);
          font-size: 15px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
        }
        .bsf-inline-add { display: flex; gap: 8px; margin-top: 8px; }
        .bsf-inline-add input {
          flex: 1;
          font-family: 'Work Sans', sans-serif;
          font-size: 14px;
          padding: 9px 10px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: #FCFAF4;
        }
        .bsf-colorinput { width: 60px; height: 36px; padding: 2px; border: 1px solid var(--line); border-radius: 8px; cursor: pointer; }
        .bsf-logo-preview { width: 64px; height: 64px; object-fit: contain; border-radius: 10px; border: 1px solid var(--line); margin: -4px 0 12px; background: var(--white); }
        .bsf-listheading { font-family: 'Fraunces', serif; font-size: 15px; font-weight: 600; margin: 4px 4px 8px; }
        .bsf-tilegrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .bsf-tile {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          background: var(--white); border: 1px solid var(--line); border-radius: 14px;
          padding: 14px 8px; cursor: pointer; box-shadow: var(--shadow-sm);
          transition: box-shadow 0.15s ease, transform 0.15s ease;
          font-size: 12px; font-weight: 600; color: var(--ink); text-align: center;
        }
        .bsf-tile:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .bsf-tile.active { border-color: var(--teal-light); background: var(--sand-deep); }
        .bsf-tile-icon {
          width: 40px; height: 40px; border-radius: 12px;
          background: linear-gradient(135deg, var(--teal), var(--teal-light));
          color: #fff; display: flex; align-items: center; justify-content: center;
        }
        .bsf-tile.active .bsf-tile-icon { background: linear-gradient(135deg, var(--gold-dark), var(--gold)); }
        .bsf-alert-note { color: #B5473B; font-weight: 600; font-size: 12.5px; margin-top: 4px; }
        .bsf-formerror { color: #B5473B; font-weight: 600; font-size: 13px; margin-top: 8px; text-align: center; }
        .bsf-attachments { margin-top: 8px; }
        .bsf-attachment-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
        .bsf-attachment-chip { display: flex; align-items: center; justify-content: space-between; background: #F7F3F2; border-radius: 8px; padding: 6px 10px; }
        .bsf-attachment-open { display: flex; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; font-size: 13px; color: #801524; padding: 0; }
        .bsf-attachment-upload { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #801524; cursor: pointer; border: 1px dashed #cbb; border-radius: 8px; padding: 6px 10px; }
        .bsf-spin { animation: bsf-spin 1s linear infinite; }
        @keyframes bsf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .bsf-student-thumb { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: #F5E4E6; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #801524; }
        .bsf-student-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .bsf-photofield { display: flex; align-items: center; gap: 12px; }
        .bsf-photofield-preview { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background: #F5E4E6; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #801524; }
        .bsf-photofield-preview img { width: 100%; height: 100%; object-fit: cover; }
        .bsf-photofield-actions { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
        .bsf-resource-link { display: inline-block; color: var(--teal); font-size: 12.5px; word-break: break-all; margin-top: 4px; }
        .bsf-ai-screen { display: flex; flex-direction: column; }
        .bsf-ai-thread { display: flex; flex-direction: column; gap: 10px; padding: 4px; flex: 1; }
        .bsf-ai-bubble {
          max-width: 85%;
          padding: 10px 13px;
          border-radius: 14px;
          font-size: 14px;
          line-height: 1.45;
          white-space: pre-wrap;
        }
        .bsf-ai-bubble.user {
          align-self: flex-end;
          background: var(--teal);
          color: var(--white);
          border-bottom-right-radius: 4px;
        }
        .bsf-ai-bubble.assistant {
          align-self: flex-start;
          background: var(--sand-deep);
          color: var(--ink);
          border-bottom-left-radius: 4px;
        }
        .bsf-ai-loading { opacity: 0.6; font-style: italic; }
        .bsf-ai-inputrow {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          padding: 10px 4px 4px;
          position: sticky;
          bottom: 0;
          background: var(--sand);
        }
        .bsf-ai-inputrow textarea {
          flex: 1;
          font-family: 'Work Sans', sans-serif;
          font-size: 14px;
          padding: 9px 10px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: #FCFAF4;
          color: var(--ink);
          resize: none;
        }
        .bsf-ai-sendbtn { background: var(--teal); color: var(--white); border-radius: 10px; padding: 10px; }
        .bsf-ai-sendbtn:hover { background: var(--teal-light); }
      `}</style>

      <div className="bsf-topbar">
        <div className="bsf-brand">
          {branding.logoUrl && <img src={branding.logoUrl} alt="School logo" className="bsf-topbar-logo" />}
          <div>
            <span className="bsf-wordmark">BrightSteps Hub</span>
            {branding.slogan && <div className="bsf-slogan">{branding.slogan}</div>}
          </div>
        </div>
        <div className="bsf-topbar-actions">
          <span className="bsf-savestate">{saving ? t("top.saving") : loaded ? t("top.saved") : t("top.loading")}</span>
          {canSwitch && (
            <button
              className="bsf-iconbtn bsf-settingsbtn"
              onClick={() => setLanguage(language === "en" ? "fr" : "en")}
              aria-label={t("top.language")}
              title={t("top.language")}
            >
              {language === "en" ? "FR" : "EN"}
            </button>
          )}
          {(!isStudent || isUpperStudent) && (
            <button className="bsf-iconbtn bsf-settingsbtn" onClick={() => setTab(isStudent ? "messages" : "students")} aria-label="Messages" title="Messages" style={{ position: "relative" }}>
              <Bell size={18} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute", top: -2, right: -2, background: "#801524", color: "#fff",
                    borderRadius: "50%", fontSize: 10, lineHeight: "16px", minWidth: 16, height: 16,
                    textAlign: "center", padding: "0 3px", fontWeight: 600
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}
          {!isStudent && (
            <button className="bsf-iconbtn bsf-settingsbtn" onClick={() => setShowMenu(true)} aria-label={t("top.menu")}>
              <MenuIcon size={19} />
            </button>
          )}
          <button className="bsf-iconbtn bsf-settingsbtn" onClick={() => setShowSettings(true)} aria-label={t("top.settings")}>
            <SettingsIcon size={18} />
          </button>
          <button className="bsf-iconbtn bsf-settingsbtn" onClick={() => signOut()} aria-label={t("settings.signOut")} title={t("settings.signOut")}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {tab === "dashboard" && <Dashboard data={data} profile={profile} persist={persist} />}
      {tab === "students" && !isLearningAssistant && (isParent ? <ParentStudentView data={data} persist={persist} profile={profile} /> : <StudentsTab data={data} persist={persist} profile={profile} />)}
      {tab === "classes" && !isParent && <ClassesTab data={data} persist={persist} profile={profile} />}
      {tab === "staff" && !isParent && !isLearningAssistant && <StaffTab data={data} persist={persist} />}
      {tab === "attendance" && <AttendanceTab data={data} persist={persist} profile={profile} />}
      {tab === "portfolio" && <PortfolioTab data={data} persist={persist} profile={profile} />}
      {tab === "messages" && isStudent && myLinkedStudent && (
        <div className="bsf-screen">
          <div className="bsf-hero">
            <p className="bsf-eyebrow">Messages</p>
            <h1>Talk with your teachers</h1>
          </div>
          <section className="bsf-card">
            <StudentMessages student={myLinkedStudent} data={data} persist={persist} />
          </section>
        </div>
      )}
      {tab === "assessment" && <AssessmentTab data={data} persist={persist} profile={profile} />}
      {tab === "gradebook" && ((!isParent && !isLearningAssistant && !isStudent) || (isStudent && isUpperStudent)) && <GradebookTab data={data} persist={persist} profile={profile} onNavigate={goTo} />}
      {tab === "planning" && !isParent && !isLearningAssistant && <PlanningTab data={data} persist={persist} />}
      {tab === "calendar" && <CalendarTab data={data} persist={persist} profile={profile} />}
      {tab === "canteen" && <CanteenTab profile={profile} />}
      {tab === "admissions" && !isParent && !isLearningAssistant && <AdmissionsTab data={data} persist={persist} />}
      {tab === "assignments" && <AssignmentsTab data={data} persist={persist} profile={profile} />}
      {tab === "reports" && !isLearningAssistant && <ReportsTab data={data} persist={persist} profile={profile} />}
      {tab === "behavior" && !isParent && !isLearningAssistant && <BehaviorTab data={data} persist={persist} />}
      {tab === "resources" && <ResourcesTab data={data} persist={persist} profile={profile} />}
      {tab === "accreditation" && (isAdmin || isViewer) && <AccreditationTab data={data} persist={persist} />}
      {tab === "billing" && BILLING_ALLOWED_ROLES.includes(profile?.role) && <BillingTab data={data} persist={persist} />}
      {false && tab === "ai" && !isParent && <AIAssistantTab data={data} />}
      {tab === "updates" && <UpdatesTab data={data} persist={persist} />}

      {showSettings && <SettingsModal data={data} persist={persist} onClose={() => setShowSettings(false)} />}

      {showMenu && (
        <Modal title={t("nav.allSections")} onClose={() => setShowMenu(false)}>
          {["classroom", "office", "compliance"]
            .map((cat) => ({
              cat,
              items: allSections.filter((s) => s.category === cat && !primaryIds.includes(s.id))
            }))
            .filter(({ items }) => items.length > 0)
            .map(({ cat, items }) => (
              <div key={cat} style={{ marginBottom: 18 }}>
                <p className="bsf-group-label">
                  {cat === "classroom" ? "Classroom" : cat === "office" ? "School office" : "Reports & compliance"}
                </p>
                <div className="bsf-tilegrid">
                  {items.map(({ id, navKey, icon: Icon }) => (
                    <button key={id} className={`bsf-tile ${tab === id ? "active" : ""}`} onClick={() => goTo(id)}>
                      <span className="bsf-tile-icon"><Icon size={19} /></span>
                      <span>{t(navKey)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </Modal>
      )}

      <nav className="bsf-tabbar">
        {bottomTabs.map(({ id, navKey, label, icon: Icon }) => (
          <button key={id} className={`bsf-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            <Icon size={19} />
            {navKey ? t(navKey) : label}
          </button>
        ))}
        {!isStudent && (
          <button className="bsf-tab" onClick={() => setShowMenu(true)}>
            <MenuIcon size={19} />
            {t("nav.more")}
          </button>
        )}
      </nav>
    </div>
  );
}


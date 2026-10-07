/**
 * Common given names a news search would mostly match as people rather than as
 * a company (ADR-010 triage rules). Hand-curated for this project: frequent
 * English given names plus common Hebrew ones, given the Israeli press the
 * collector also reads. Lower case, one per token.
 */
const NAMES = `
aaron abigail adam adrian aiden alan albert alex alexander alexandra alice alicia allison amanda amber amelia amy
andrea andrew angela anna anne anthony antonio april arthur ashley audrey austin ava barbara benjamin bernard
beth betty beverly bill billy bob bobby bonnie brad bradley brandon brenda brian brittany bruce bryan caleb
cameron carl carla carlos carmen carol caroline carter casey casper catherine charles charlie charlotte chase
cheryl chloe chris christian christina christine christopher cindy claire clara clarence claude clayton cody
colin connor craig crystal curtis cynthia daisy dale dan dana daniel danielle danny david dean deborah debra
dennis derek diana diane donald donna doris dorothy douglas dylan edgar edward elaine eleanor elena eli elijah
elizabeth ella ellen emily emma eric erica erin ethan eugene eva evan evelyn felix frances francis frank fred
frederick gabriel gail gary gavin george gerald gina glen gloria grace grant greg gregory hailey hannah harold
harper harry harvey hazel heather helen henry holly howard hugo ian isaac isabel isabella ivan jack jackson
jacob jacqueline jake james jamie jane janet janice jared jason jean jeff jeffrey jennifer jeremy jerry jesse
jessica jill jim jimmy joan joe joel john johnny jonathan jordan jose joseph joshua joy joyce juan judith judy
julia julian julie justin karen kate katherine kathleen kathryn katie keith kelly kelvin ken kenneth kevin kim
kimberly kyle larry laura lauren lawrence leah lee leo leon leonard lily linda lisa logan lois louis louise
lucas lucy luis luke lydia madison maggie marcus margaret maria marie marilyn mario mark martha martin mary mason
matthew max maya megan melissa michael michelle mike mila miles milo molly monica morgan nancy natalie nathan
neil nicholas nicole noah nora norman oliver olivia oscar owen pamela patricia patrick paul paula peggy penny
peter philip phillip phyllis rachel ralph randy ray raymond rebecca regina rick richard riley rita rob robert
robin roger ronald rose ruby russell ruth ryan sally samantha samuel sandra sara sarah scott sean sharon shirley
sophia sophie stanley stella stephanie stephen steve steven sue susan tammy tara ted teresa terry theodore
theresa thomas tiffany timothy tina todd tom tony tracy travis tyler valerie vanessa victor victoria vincent
virginia walter wayne wendy william willie zachary zoe

adi alon amit amir anat ariel asaf avi avital ayelet boaz chen dafna dana dor dov eitan elad eli erez eyal gal
gil guy hadas idan ilan inbar itai lior liron maya meir michal moshe nadav naama neta nir noa noam ofer omer ori
oren ran reut ronit roni ruth shai shani shira shlomo tal tamar tomer uri yael yair yoav yonatan yossi ziv
`;

export const FIRST_NAMES: ReadonlySet<string> = new Set(NAMES.split(/\s+/).filter((name) => name !== ''));
